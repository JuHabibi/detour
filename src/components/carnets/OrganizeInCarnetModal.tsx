"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFavorite, removeFavorite } from "@/app/actions/favorites";
import {
  addFavoritesToGroup,
  createGroupWithFavorites,
  removeEventFromGroup,
} from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import { MAX_GROUPS_PER_USER } from "@/application/groups/limits";
import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import { resolveCategoryBadgeTone } from "@/components/event/category-badge-style";
import { AppModal } from "@/components/ui/AppModal";
import type { EventItem } from "@/data/types";
import { carnetCoverTone } from "@/components/carnets/carnet-cover-tone";
import { replaceEventMemberships } from "@/features/account/groups/membership-index";
import { cn } from "@/lib/cn";

export type OrganizeInCarnetModalProps = {
  event: EventItem;
  groups: GroupSummary[];
  memberships: EventGroupMembership[];
  /** True si déjà favori — sinon Enregistrer ajoute d’abord le favori. */
  isFavorite?: boolean;
  onClose: () => void;
  onGroupsChange?: (groups: GroupSummary[]) => void;
  onMembershipsChange?: (memberships: EventGroupMembership[]) => void;
  onFavoriteAdded?: (eventId: string) => void;
  /** Après retrait explicite des favoris (et associations carnets). */
  onFavoriteRemoved?: (eventId: string) => void;
  onSuccess?: () => void;
  returnFocusTo?: HTMLElement | null;
};

function initiallyCheckedIds(
  eventId: string,
  groups: GroupSummary[],
  memberships: EventGroupMembership[],
): Set<string> {
  const checked = new Set<string>();
  for (const group of groups) {
    if (
      memberships.some((m) => m.groupId === group.id && m.eventId === eventId)
    ) {
      checked.add(group.id);
    }
  }
  return checked;
}

function carnetCountLabel(n: number): string {
  if (n === 0) return "0 idée enregistrée";
  return n === 1 ? "1 idée enregistrée" : `${n} idées enregistrées`;
}

/**
 * Modale de classement partagée Account / Radar / Explorer.
 * AppModal = coquille ; contenu fidèle au proto « Garder cette affiche… ».
 */
export function OrganizeInCarnetModal({
  event,
  groups,
  memberships,
  isFavorite = true,
  onClose,
  onGroupsChange,
  onMembershipsChange,
  onFavoriteAdded,
  onFavoriteRemoved,
  onSuccess,
  returnFocusTo,
}: OrganizeInCarnetModalProps) {
  const router = useRouter();
  const eventIds = useMemo(() => [event.id], [event.id]);
  const [localGroups, setLocalGroups] = useState(groups);
  const [checkedIds, setCheckedIds] = useState(() =>
    initiallyCheckedIds(event.id, groups, memberships),
  );
  const initialChecked = useMemo(
    () => initiallyCheckedIds(event.id, groups, memberships),
    [event.id, groups, memberships],
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const atLimit = localGroups.length >= MAX_GROUPS_PER_USER;
  const whenLabel = event.time
    ? `${event.dateLabel} · ${event.time}`
    : event.dateLabel;
  const categoryLabel = resolveCategoryBadgeLabel(event);
  const place = [event.venue?.trim(), event.city?.trim()]
    .filter(Boolean)
    .join(" · ");

  function updateGroups(next: GroupSummary[]) {
    setLocalGroups(next);
    onGroupsChange?.(next);
  }

  function toggleGroup(groupId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const toAdd = localGroups.filter(
      (g) => checkedIds.has(g.id) && !initialChecked.has(g.id),
    );
    const toRemove = localGroups.filter(
      (g) => !checkedIds.has(g.id) && initialChecked.has(g.id),
    );

    if (toAdd.length === 0 && toRemove.length === 0 && isFavorite) {
      onClose();
      return;
    }

    startTransition(async () => {
      if (!isFavorite) {
        const fav = await addFavorite(event.id);
        if (!fav.ok) {
          setError(
            fav.reason === "unauthenticated"
              ? "Connectez-vous pour ranger cette découverte."
              : "Impossible d’ajouter aux favoris. Réessayez.",
          );
          return;
        }
        onFavoriteAdded?.(event.id);
      }

      if (toAdd.length > 0) {
        const addResults = await Promise.all(
          toAdd.map((g) => addFavoritesToGroup(g.id, eventIds)),
        );
        if (addResults.some((r) => !r.ok)) {
          setError("Impossible de mettre à jour les carnets. Réessayez.");
          return;
        }
      }

      if (toRemove.length > 0) {
        const removeResults = await Promise.all(
          toRemove.map((g) => removeEventFromGroup(g.id, event.id)),
        );
        if (removeResults.some((r) => !r.ok)) {
          setError("Impossible de mettre à jour les carnets. Réessayez.");
          return;
        }
      }

      const selectedGroups = localGroups
        .filter((g) => checkedIds.has(g.id))
        .map((g) => ({ groupId: g.id, groupName: g.name }));

      onMembershipsChange?.(
        replaceEventMemberships(memberships, eventIds, selectedGroups),
      );

      updateGroups(
        localGroups.map((g) => {
          const was = initialChecked.has(g.id);
          const now = checkedIds.has(g.id);
          if (was === now) return g;
          if (!was && now) {
            return { ...g, eventCount: g.eventCount + 1 };
          }
          return { ...g, eventCount: Math.max(0, g.eventCount - 1) };
        }),
      );

      onSuccess?.();
      router.refresh();
      onClose();
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (atLimit) {
      setError("Vous avez atteint la limite de 4 carnets.");
      return;
    }
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Indiquez un nom de carnet.");
      return;
    }

    startTransition(async () => {
      if (!isFavorite) {
        const fav = await addFavorite(event.id);
        if (!fav.ok) {
          setError("Impossible d’ajouter aux favoris. Réessayez.");
          return;
        }
        onFavoriteAdded?.(event.id);
      }

      const result = await createGroupWithFavorites(trimmed, eventIds);
      if (!result.ok) {
        setError(
          result.reason === "limit_reached"
            ? "Vous avez atteint la limite de 4 carnets."
            : result.reason === "invalid"
              ? "Indiquez un nom de carnet."
              : "Impossible de créer. Réessayez.",
        );
        return;
      }

      if (result.group) {
        const created: GroupSummary = {
          ...result.group,
          eventCount: Math.max(1, result.addedCount),
          earliestStartAt: null,
          latestStartAt: null,
        };
        const nextGroups = [created, ...localGroups];
        updateGroups(nextGroups);
        setCheckedIds((current) => new Set(current).add(created.id));
        onMembershipsChange?.(
          replaceEventMemberships(memberships, eventIds, [
            { groupId: created.id, groupName: created.name },
            ...localGroups
              .filter((g) => checkedIds.has(g.id))
              .map((g) => ({ groupId: g.id, groupName: g.name })),
          ]),
        );
      }

      setNewName("");
      setCreating(false);
      onSuccess?.();
      router.refresh();
    });
  }

  function handleRemoveFavorite() {
    setError(null);
    startTransition(async () => {
      const associatedGroupIds = [
        ...new Set(
          memberships
            .filter((m) => m.eventId === event.id)
            .map((m) => m.groupId),
        ),
      ];

      if (associatedGroupIds.length > 0) {
        const removeResults = await Promise.all(
          associatedGroupIds.map((groupId) =>
            removeEventFromGroup(groupId, event.id),
          ),
        );
        if (removeResults.some((r) => !r.ok)) {
          setError("Impossible de retirer des carnets. Réessayez.");
          return;
        }
      }

      const fav = await removeFavorite(event.id);
      if (!fav.ok) {
        setError(
          fav.reason === "unauthenticated"
            ? "Connectez-vous pour modifier vos favoris."
            : "Impossible de retirer des favoris. Réessayez.",
        );
        return;
      }

      const associatedSet = new Set(associatedGroupIds);
      updateGroups(
        localGroups.map((g) =>
          associatedSet.has(g.id)
            ? { ...g, eventCount: Math.max(0, g.eventCount - 1) }
            : g,
        ),
      );
      onMembershipsChange?.(
        memberships.filter((m) => m.eventId !== event.id),
      );
      onFavoriteRemoved?.(event.id);
      onSuccess?.();
      router.refresh();
      onClose();
    });
  }

  return (
    <AppModal
      eyebrow="Ajouter une découverte"
      title="Garder cette affiche dans un carnet."
      onClose={onClose}
      size="md"
      returnFocusTo={returnFocusTo}
      footer={
        <button
          type="submit"
          form="organize-carnet-form"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center bg-ink px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-foam transition-colors hover:bg-coral disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      }
    >
      <div className="border border-line bg-sky-soft/60 px-4 py-3">
        <p
          className={cn(
            "inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
            resolveCategoryBadgeTone(event.category),
          )}
        >
          {categoryLabel}
        </p>
        <p className="mt-2 font-display text-[1.2rem] font-semibold leading-[1.08] tracking-tight text-ink">
          {event.title}
        </p>
        <p className="mt-1 text-[12px] text-sand">
          {whenLabel}
          {place ? ` · ${place}` : ""}
        </p>
      </div>

      <p className="mt-5 text-sm leading-6 text-cream-dim">
        Choisissez où retrouver cette idée plus tard.
      </p>

      <form
        id="organize-carnet-form"
        onSubmit={handleValidate}
        className="mt-4"
      >
        {localGroups.length === 0 ? (
          <p className="text-sm leading-6 text-cream-dim">
            Aucun carnet pour l’instant. Créez-en un ci-dessous.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {localGroups.map((group, index) => {
              const tone = carnetCoverTone(index);
              const inputId = `organize-carnet-${group.id}`;
              const selected = checkedIds.has(group.id);
              const already = initialChecked.has(group.id) && selected;
              return (
                <li key={group.id}>
                  <label
                    htmlFor={inputId}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border border-line bg-foam px-3 py-3 transition-colors",
                      selected && "bg-mint-soft/50 border-mint",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("size-2.5 shrink-0 rounded-full", tone.bg)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {group.name}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-sand">
                        {already
                          ? "Déjà dans ce carnet"
                          : carnetCountLabel(group.eventCount)}
                      </span>
                    </span>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleGroup(group.id)}
                      disabled={pending}
                      className="size-5 shrink-0 accent-ink"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      {atLimit ? (
        <p className="mt-5 text-[12px] text-sand">
          Vous avez atteint la limite de 4 carnets.
        </p>
      ) : creating ? (
        <form onSubmit={handleCreate} className="mt-5 border-t border-line pt-5">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
              Nom du carnet
            </span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex. Escapade à Nantes"
              maxLength={80}
              autoFocus
              className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-sand focus:border-ink"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="inline-flex min-h-10 items-center px-3 text-[12px] uppercase tracking-[0.1em] text-sand"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-10 items-center bg-mint px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink disabled:opacity-60"
            >
              Créer
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-5 text-[12px] font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:text-coral"
        >
          + Créer un nouveau carnet
        </button>
      )}

      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}

      {isFavorite ? (
        <div className="mt-6 border-t border-line pt-5">
          <button
            type="button"
            disabled={pending}
            onClick={handleRemoveFavorite}
            className="text-[12px] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-coral disabled:opacity-60"
          >
            Retirer des favoris
          </button>
          <p className="mt-1.5 text-[12px] leading-5 text-sand/80">
            L’événement quittera aussi vos carnets.
          </p>
        </div>
      ) : null}
    </AppModal>
  );
}
