"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFavorite } from "@/app/actions/favorites";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import type { EventItem } from "@/data/types";
import { authClient } from "@/lib/auth-client";
import { AccountAddToGroupModal } from "@/features/account/components/AccountAddToGroupModal";
import { AccountCarnetsLibrary } from "@/features/account/components/AccountCarnetsLibrary";
import { AccountEmptyFavorites } from "@/features/account/components/AccountEmptyFavorites";
import { AccountFavoriteCard } from "@/features/account/components/AccountFavoriteCard";
import { buildMembershipMap, filterFavoriteIds, type FavoriteFilter } from "@/features/account/groups/membership-index";
import { takeServerListIfChanged } from "@/features/account/take-server-list-if-changed";

export type AccountUserView = {
  name: string;
  email: string;
};

type AccountSignedInProps = {
  user: AccountUserView;
  initialFavorites?: EventItem[];
  initialGroups?: GroupSummary[];
  initialMemberships?: EventGroupMembership[];
};

type GroupModalTarget =
  | { kind: "single"; event: EventItem }
  | { kind: "bulk"; eventIds: string[] };

export function AccountSignedIn({
  user,
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
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<FavoriteFilter>({ kind: "all" });
  const [, startTransition] = useTransition();

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

  function handleRemove(id: string) {
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
      const result = await removeFavorite(id);
      if (result.ok) {
        router.refresh();
        return;
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

  async function handleLogout() {
    setLogoutPending(true);
    setLogoutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setLogoutError("Impossible de se déconnecter. Réessayez.");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setLogoutError("Impossible de se déconnecter. Réessayez.");
    } finally {
      setLogoutPending(false);
    }
  }

  const groupModalHeading =
    groupModal?.kind === "single"
      ? groupModal.event.title
      : groupModal
        ? `${groupModal.eventIds.length} favori${groupModal.eventIds.length > 1 ? "s" : ""}`
        : "";

  return (
    <div className={selectionMode && selectedCount > 0 ? "pb-28" : undefined}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 max-w-xl">
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

        <details
          className="relative shrink-0"
          open={accountOpen}
          onToggle={(e) => setAccountOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-[0.12em] text-sand transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            Compte
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-56 border border-line bg-foam p-4 shadow-sm">
            <p className="font-display text-base tracking-tight text-ink">
              {user.name}
            </p>
            <p className="mt-1 truncate text-[12px] text-sand">{user.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutPending}
              className="mt-4 text-[12px] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
            >
              {logoutPending ? "Déconnexion…" : "Se déconnecter"}
            </button>
            {logoutError ? (
              <p className="mt-2 text-sm text-coral" role="alert">
                {logoutError}
              </p>
            ) : null}
          </div>
        </details>
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

      <section ref={favoritesRef} className="mt-12 scroll-mt-24 md:mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[1.45rem] tracking-tight text-ink md:text-[1.65rem]">
              Mes favoris
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-cream-dim">
              {activeGroupName
                ? `Favoris du carnet « ${activeGroupName} ».`
                : "Tous vos événements sauvegardés, classés ou non."}
              {activeGroupName ? (
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
                Aucun favori dans ce carnet.
              </p>
            ) : (
              <div className="mt-2">
                {filteredFavorites.map((event) => (
                  <AccountFavoriteCard
                    key={event.id}
                    event={event}
                    carnets={membershipMap.get(event.id) ?? []}
                    onRemove={handleRemove}
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

      {groupModal ? (
        <AccountAddToGroupModal
          eventIds={
            groupModal.kind === "single"
              ? [groupModal.event.id]
              : groupModal.eventIds
          }
          heading={groupModalHeading}
          groups={groups}
          memberships={memberships}
          onClose={() => setGroupModal(null)}
          onGroupsChange={setGroups}
          onMembershipsChange={setMemberships}
          onSuccess={
            groupModal.kind === "bulk" ? exitSelectionMode : undefined
          }
        />
      ) : null}
    </div>
  );
}
