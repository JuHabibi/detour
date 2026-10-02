"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFavorite } from "@/app/actions/favorites";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import type { EventItem } from "@/data/types";
import { OrganizeInCarnetModal } from "@/components/carnets/OrganizeInCarnetModal";
import { RemoveFavoriteConfirmModal } from "@/components/favorites/RemoveFavoriteConfirmModal";
import { AccountAddToGroupModal } from "@/features/account/components/carnets/AccountAddToGroupModal";
import { AccountCarnetsLibrary } from "@/features/account/components/carnets/AccountCarnetsLibrary";
import { AccountEmptyFavorites } from "@/features/account/components/favorites/AccountEmptyFavorites";
import { AccountFavoriteCard } from "@/features/account/components/favorites/AccountFavoriteCard";
import {
  buildMembershipMap,
  countFavoritesInGroup,
  countFavoritesWithoutCarnet,
  filterFavoriteIds,
  type FavoriteFilter,
} from "@/features/account/groups/membership-index";
import { takeServerListIfChanged } from "@/features/account/take-server-list-if-changed";
import { cn } from "@/lib/cn";

type AccountSignedInProps = {
  initialFavorites?: EventItem[];
  initialGroups?: GroupSummary[];
  initialMemberships?: EventGroupMembership[];
};

type GroupModalTarget =
  | { kind: "single"; event: EventItem }
  | { kind: "bulk"; eventIds: string[] };

export function AccountSignedIn({
  initialFavorites = [],
  initialGroups = [],
  initialMemberships = [],
}: AccountSignedInProps) {
  const router = useRouter();
  const favoritesRef = useRef<HTMLElement | null>(null);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [groups, setGroups] = useState(initialGroups);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [groupsPropSnapshot, setGroupsPropSnapshot] = useState(initialGroups);
  const [membershipsPropSnapshot, setMembershipsPropSnapshot] = useState(
    initialMemberships,
  );

  const serverGroups = takeServerListIfChanged(
    initialGroups,
    groupsPropSnapshot,
  );
  if (serverGroups) {
    setGroupsPropSnapshot(serverGroups);
    setGroups(serverGroups);
  }
  const serverMemberships = takeServerListIfChanged(
    initialMemberships,
    membershipsPropSnapshot,
  );
  if (serverMemberships) {
    setMembershipsPropSnapshot(serverMemberships);
    setMemberships(serverMemberships);
  }

  const [groupModal, setGroupModal] = useState<GroupModalTarget | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{
    eventId: string;
    returnFocusTo: HTMLElement | null;
  } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<FavoriteFilter>({ kind: "all" });
  const [pending, startTransition] = useTransition();

  /** Ancre #favoris : filtre Tous + scroll sous le header sticky. */
  useEffect(() => {
    function applyFavorisHash() {
      if (window.location.hash !== "#favoris") return;
      setFilter({ kind: "all" });
      requestAnimationFrame(() => {
        favoritesRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }

    applyFavorisHash();
    window.addEventListener("hashchange", applyFavorisHash);
    return () => window.removeEventListener("hashchange", applyFavorisHash);
  }, []);

  const favoriteIds = useMemo(
    () => favorites.map((f) => f.id),
    [favorites],
  );
  const membershipMap = useMemo(
    () => buildMembershipMap(memberships, groups),
    [memberships, groups],
  );

  const effectiveFilter = useMemo<FavoriteFilter>(() => {
    if (filter.kind === "group" && !groups.some((g) => g.id === filter.groupId)) {
      return { kind: "all" };
    }
    return filter;
  }, [filter, groups]);

  const filteredIds = useMemo(
    () => new Set(filterFavoriteIds(favoriteIds, memberships, effectiveFilter)),
    [favoriteIds, memberships, effectiveFilter],
  );
  const filteredFavorites = useMemo(
    () => favorites.filter((f) => filteredIds.has(f.id)),
    [favorites, filteredIds],
  );

  const activeGroupId =
    effectiveFilter.kind === "group" ? effectiveFilter.groupId : null;
  const selectedCount = selectedIds.size;
  const activeGroupName =
    activeGroupId != null
      ? (groups.find((g) => g.id === activeGroupId)?.name ?? null)
      : null;
  const withoutCarnetCount = useMemo(
    () => countFavoritesWithoutCarnet(favoriteIds, memberships),
    [favoriteIds, memberships],
  );

  const filterChips = useMemo(() => {
    const chips: {
      key: string;
      label: string;
      count: number;
      filter: FavoriteFilter;
      active: boolean;
    }[] = [
      {
        key: "all",
        label: "Tous",
        count: favorites.length,
        filter: { kind: "all" },
        active: effectiveFilter.kind === "all",
      },
      {
        key: "none",
        label: "Sans carnet",
        count: withoutCarnetCount,
        filter: { kind: "none" },
        active: effectiveFilter.kind === "none",
      },
    ];
    for (const group of groups) {
      chips.push({
        key: group.id,
        label: group.name,
        count: countFavoritesInGroup(favoriteIds, memberships, group.id),
        filter: { kind: "group", groupId: group.id },
        active:
          effectiveFilter.kind === "group" &&
          effectiveFilter.groupId === group.id,
      });
    }
    return chips;
  }, [
    effectiveFilter,
    favoriteIds,
    favorites.length,
    groups,
    memberships,
    withoutCarnetCount,
  ]);

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds(new Set());
    setGroupModal(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function scrollToFavorites() {
    favoritesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Clic couverture / pastille : filtre (re-clic = tous). */
  function applyGroupFilter(groupId: string) {
    setFilter((current) =>
      current.kind === "group" && current.groupId === groupId
        ? { kind: "all" }
        : { kind: "group", groupId },
    );
    scrollToFavorites();
  }

  function requestRemove(id: string) {
    setRemoveError(null);
    const returnFocusTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const inCarnets = memberships.some((m) => m.eventId === id);
    if (inCarnets) {
      setPendingRemove({ eventId: id, returnFocusTo });
      return;
    }
    performRemove(id);
  }

  function performRemove(id: string) {
    setPendingRemove(null);
    setRemoveError(null);
    const previous = favorites;
    const previousMemberships = memberships;
    setFavorites((current) => current.filter((event) => event.id !== id));
    setMemberships((current) => current.filter((m) => m.eventId !== id));
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setGroupModal((current) => {
      if (!current) return null;
      if (current.kind === "single" && current.event.id === id) return null;
      if (current.kind === "bulk") {
        const nextIds = current.eventIds.filter((eventId) => eventId !== id);
        return nextIds.length > 0 ? { kind: "bulk", eventIds: nextIds } : null;
      }
      return current;
    });

    startTransition(async () => {
      try {
        const result = await removeFavorite(id);
        if (result.ok) {
          router.refresh();
          return;
        }
      } catch (error) {
        console.error("[detour:account] removeFavorite failed", error);
      }
      setFavorites(previous);
      setMemberships(previousMemberships);
      setRemoveError("Impossible de retirer ce favori. Réessayez.");
    });
  }

  function handleOpenAddToGroup(id: string) {
    const event = favorites.find((item) => item.id === id) ?? null;
    if (!event) return;
    setGroupModal({ kind: "single", event });
  }

  function handleOpenBulkAddToGroup() {
    if (selectedIds.size === 0) return;
    setGroupModal({ kind: "bulk", eventIds: [...selectedIds] });
  }

  const groupModalHeading =
    groupModal?.kind === "bulk"
      ? `${groupModal.eventIds.length} favori${groupModal.eventIds.length > 1 ? "s" : ""}`
      : "";

  const organizeEvent =
    groupModal?.kind === "single" ? groupModal.event : null;

  const filterCaption =
    effectiveFilter.kind === "none"
      ? "Favoris non rangés dans un carnet."
      : activeGroupName
        ? `Favoris du carnet « ${activeGroupName} ».`
        : "Tous vos événements sauvegardés, classés ou non.";

  return (
    <div className={selectionMode && selectedCount > 0 ? "pb-28" : undefined}>
      <div className="max-w-xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
          Votre collection personnelle
        </p>
        <h1 className="mt-3 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-4 md:text-[2.75rem] lg:text-[3rem]">
          Mes carnets.
        </h1>
        <p className="mt-4 text-sm leading-6 text-cream-dim md:mt-5">
          Toutes vos découvertes, vos envies et vos prochaines sorties au même
          endroit.
        </p>
      </div>

      {removeError ? (
        <p className="mt-6 text-sm text-coral" role="alert">
          {removeError}
        </p>
      ) : null}

      <AccountCarnetsLibrary
        groups={groups}
        memberships={memberships}
        activeGroupId={activeGroupId}
        onSelectGroup={applyGroupFilter}
        onGroupsChange={setGroups}
        onMembershipsChange={setMemberships}
      />

      <section
        id="favoris"
        ref={favoritesRef}
        className="mt-12 scroll-mt-24 md:mt-16 md:scroll-mt-28"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[1.45rem] tracking-tight text-ink md:text-[1.65rem]">
              Mes favoris
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-cream-dim">
              {filterCaption}
              {effectiveFilter.kind !== "all" ? (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setFilter({ kind: "all" })}
                    className="underline decoration-line underline-offset-4 transition-colors hover:text-ink"
                  >
                    Tout afficher
                  </button>
                </>
              ) : null}
            </p>
          </div>
          {favorites.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                selectionMode ? exitSelectionMode() : enterSelectionMode()
              }
              className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline decoration-line underline-offset-4 transition-colors hover:text-coral"
            >
              {selectionMode ? "Annuler" : "Sélectionner"}
            </button>
          ) : null}
        </div>

        {favorites.length > 0 ? (
          <div
            className="mt-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrer les favoris"
          >
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.filter)}
                aria-pressed={chip.active}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 border px-3 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors",
                  chip.active
                    ? "border-ink bg-ink text-foam"
                    : "border-line bg-foam text-ink hover:border-ink",
                )}
              >
                <span className="max-w-[12rem] truncate">{chip.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    chip.active ? "text-foam/70" : "text-sand",
                  )}
                >
                  {chip.count}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {favorites.length === 0 ? (
          <div className="mt-8">
            <AccountEmptyFavorites />
          </div>
        ) : (
          <>
            {selectionMode ? (
              <p
                className="mt-4 text-[12px] uppercase tracking-[0.12em] text-sand"
                aria-live="polite"
              >
                {selectedCount === 0
                  ? "Aucun sélectionné"
                  : `${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""}`}
              </p>
            ) : null}

            {filteredFavorites.length === 0 ? (
              <p className="mt-8 text-sm leading-6 text-cream-dim">
                {effectiveFilter.kind === "none"
                  ? "Tous vos favoris sont déjà rangés dans un carnet."
                  : "Aucun favori dans ce carnet."}
              </p>
            ) : (
              <div className="mt-2">
                {filteredFavorites.map((event) => (
                  <AccountFavoriteCard
                    key={event.id}
                    event={event}
                    carnets={membershipMap.get(event.id) ?? []}
                    onRemove={requestRemove}
                    onAddToGroup={
                      selectionMode ? undefined : handleOpenAddToGroup
                    }
                    onCarnetClick={applyGroupFilter}
                    secondaryInMenu
                    selectionMode={selectionMode}
                    selected={selectedIds.has(event.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {selectionMode && selectedCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-foam/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[var(--detour-shell-max)] items-center justify-between gap-4 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-sand">
              {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={handleOpenBulkAddToGroup}
              className="inline-flex min-h-11 items-center justify-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
            >
              Ranger dans des carnets
            </button>
          </div>
        </div>
      ) : null}

      {organizeEvent ? (
        <OrganizeInCarnetModal
          event={organizeEvent}
          groups={groups}
          memberships={memberships}
          isFavorite
          onClose={() => setGroupModal(null)}
          onGroupsChange={setGroups}
          onMembershipsChange={setMemberships}
        />
      ) : null}

      {groupModal?.kind === "bulk" ? (
        <AccountAddToGroupModal
          eventIds={groupModal.eventIds}
          heading={groupModalHeading}
          groups={groups}
          memberships={memberships}
          onClose={() => setGroupModal(null)}
          onGroupsChange={setGroups}
          onMembershipsChange={setMemberships}
          onSuccess={exitSelectionMode}
        />
      ) : null}

      {pendingRemove ? (
        <RemoveFavoriteConfirmModal
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => performRemove(pendingRemove.eventId)}
          returnFocusTo={pendingRemove.returnFocusTo}
          pending={pending}
        />
      ) : null}
    </div>
  );
}
