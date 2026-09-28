"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFavoritesToGroup,
  createGroupWithFavorites,
  removeEventFromGroup,
} from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import { AppModal } from "@/components/ui/AppModal";
import { replaceEventMemberships } from "@/features/account/groups/membership-index";

type AccountAddToGroupModalProps = {
  eventIds: string[];
  heading: string;
  groups: GroupSummary[];
  memberships: EventGroupMembership[];
  onClose: () => void;
  onGroupsChange?: (groups: GroupSummary[]) => void;
  onMembershipsChange?: (memberships: EventGroupMembership[]) => void;
  onSuccess?: () => void;
};

function initiallyCheckedIds(
  eventIds: string[],
  groups: GroupSummary[],
  memberships: EventGroupMembership[],
): Set<string> {
  const checked = new Set<string>();
  for (const group of groups) {
    const members = new Set(
      memberships
        .filter((m) => m.groupId === group.id)
        .map((m) => m.eventId),
    );
    if (eventIds.every((id) => members.has(id))) {
      checked.add(group.id);
    }
  }
  return checked;
}

export function AccountAddToGroupModal({
  eventIds,
  heading,
  groups,
  memberships,
  onClose,
  onGroupsChange,
  onMembershipsChange,
  onSuccess,
}: AccountAddToGroupModalProps) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [checkedIds, setCheckedIds] = useState(() =>
    initiallyCheckedIds(eventIds, groups, memberships),
  );
  const initialChecked = useMemo(
    () => initiallyCheckedIds(eventIds, groups, memberships),
    [eventIds, groups, memberships],
  );

  const countLabel =
    eventIds.length === 1
      ? "1 favori"
      : `${eventIds.length} favoris`;

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

    const toAdd = groups.filter(
      (g) => checkedIds.has(g.id) && !initialChecked.has(g.id),
    );
    const toRemove = groups.filter(
      (g) => !checkedIds.has(g.id) && initialChecked.has(g.id),
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      onClose();
      return;
    }

    startTransition(async () => {
      const addResults = await Promise.all(
        toAdd.map((g) => addFavoritesToGroup(g.id, eventIds)),
      );
      if (addResults.some((r) => !r.ok)) {
        setError("Impossible de mettre à jour les carnets. Réessayez.");
        return;
      }

      const removeResults = await Promise.all(
        toRemove.flatMap((g) =>
          eventIds.map((eventId) => removeEventFromGroup(g.id, eventId)),
        ),
      );
      if (removeResults.some((r) => !r.ok)) {
        setError("Impossible de mettre à jour les carnets. Réessayez.");
        return;
      }

      const selectedGroups = groups
        .filter((g) => checkedIds.has(g.id))
        .map((g) => ({ groupId: g.id, groupName: g.name }));

      onMembershipsChange?.(
        replaceEventMemberships(memberships, eventIds, selectedGroups),
      );

      const eventSet = new Set(eventIds);
      onGroupsChange?.(
        groups.map((g) => {
          const was = initialChecked.has(g.id);
          const now = checkedIds.has(g.id);
          if (was === now) return g;
          if (!was && now) {
            const alreadyIn = memberships.filter(
              (m) => m.groupId === g.id && eventSet.has(m.eventId),
            ).length;
            const added = eventIds.length - alreadyIn;
            return {
              ...g,
              eventCount: g.eventCount + Math.max(0, added),
            };
          }
          return {
            ...g,
            eventCount: Math.max(0, g.eventCount - eventIds.length),
          };
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
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Indiquez un nom de carnet.");
      return;
    }

    startTransition(async () => {
      const result = await createGroupWithFavorites(trimmed, eventIds);
      if (!result.ok) {
        setError(
          result.reason === "not_found" || result.reason === "event_not_found"
            ? "Impossible d’ajouter à ce carnet."
            : result.reason === "invalid"
              ? "Sélection invalide."
              : "Impossible de créer. Réessayez.",
        );
        return;
      }

      if (result.group) {
        const created = {
          ...result.group,
          eventCount: result.addedCount,
          earliestStartAt: null,
          latestStartAt: null,
        };
        onGroupsChange?.([created, ...groups]);
        const selectedGroups = [
          { groupId: created.id, groupName: created.name },
          ...groups
            .filter((g) => checkedIds.has(g.id))
            .map((g) => ({ groupId: g.id, groupName: g.name })),
        ];
        const toAdd = groups.filter(
          (g) => checkedIds.has(g.id) && !initialChecked.has(g.id),
        );
        const toRemove = groups.filter(
          (g) => !checkedIds.has(g.id) && initialChecked.has(g.id),
        );
        if (toAdd.length > 0) {
          await Promise.all(
            toAdd.map((g) => addFavoritesToGroup(g.id, eventIds)),
          );
        }
        if (toRemove.length > 0) {
          await Promise.all(
            toRemove.flatMap((g) =>
              eventIds.map((eventId) => removeEventFromGroup(g.id, eventId)),
            ),
          );
        }
        onMembershipsChange?.(
          replaceEventMemberships(memberships, eventIds, selectedGroups),
        );
      }

      setNewName("");
      onSuccess?.();
      router.refresh();
      onClose();
    });
  }

  return (
    <AppModal
      eyebrow="Ranger dans des carnets"
      title={heading}
      description={countLabel}
      onClose={onClose}
      footer={
        groups.length > 0 ? (
          <button
            type="submit"
            form="add-to-carnet-form"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Valider"}
          </button>
        ) : null
      }
    >
      <form
        id="add-to-carnet-form"
        onSubmit={handleValidate}
        className="flex min-h-0 flex-col"
      >
        {groups.length === 0 ? (
          <p className="text-sm leading-6 text-cream-dim">
            Aucun carnet pour l’instant. Créez-en un ci-dessous.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {groups.map((group) => {
              const inputId = `carnet-${group.id}`;
              return (
                <li key={group.id}>
                  <label
                    htmlFor={inputId}
                    className="flex cursor-pointer items-center gap-3 py-3.5"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checkedIds.has(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      disabled={pending}
                      className="size-5 shrink-0 accent-ink"
                    />
                    <span className="min-w-0 truncate font-display text-[1.05rem] text-ink">
                      {group.name}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      <form
        onSubmit={handleCreate}
        className="mt-5 border-t border-line pt-5"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
          Créer un carnet
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom"
            maxLength={80}
            className="min-w-0 flex-1 border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-sand focus:border-ink"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center bg-ink px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-foam transition-colors hover:bg-coral disabled:opacity-60"
          >
            Créer
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </AppModal>
  );
}
