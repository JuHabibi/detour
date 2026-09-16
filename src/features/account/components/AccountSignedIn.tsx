"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFavorite } from "@/app/actions/favorites";
import type { GroupSummary } from "@/application/groups";
import type { EventItem } from "@/data/types";
import { authClient } from "@/features/account/auth-client";
import { AccountAddToGroupModal } from "@/features/account/components/AccountAddToGroupModal";
import { AccountEmptyFavorites } from "@/features/account/components/AccountEmptyFavorites";
import { AccountFavoriteCard } from "@/features/account/components/AccountFavoriteCard";
import { AccountGroupsSection } from "@/features/account/components/AccountGroupsSection";
import { takeServerListIfChanged } from "@/features/account/take-server-list-if-changed";

export type AccountUserView = {
  name: string;
  email: string;
};

type AccountSignedInProps = {
  user: AccountUserView;
  initialFavorites?: EventItem[];
  initialGroups?: GroupSummary[];
};

type GroupModalTarget =
  | { kind: "single"; event: EventItem }
  | { kind: "bulk"; eventIds: string[] };

export function AccountSignedIn({
  user,
  initialFavorites = [],
  initialGroups = [],
}: AccountSignedInProps) {
  const router = useRouter();
  const [favorites, setFavorites] = useState(initialFavorites);
  const [groups, setGroups] = useState(initialGroups);
  const [groupsPropSnapshot, setGroupsPropSnapshot] = useState(initialGroups);
  const serverGroups = takeServerListIfChanged(
    initialGroups,
    groupsPropSnapshot,
  );
  if (serverGroups) {
    setGroupsPropSnapshot(serverGroups);
    setGroups(serverGroups);
  }
  const [groupModal, setGroupModal] = useState<GroupModalTarget | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

  const countLabel = useMemo(() => {
    const n = favorites.length;
    if (n === 0) return "Aucun favori";
    return `${n} favori${n > 1 ? "s" : ""}`;
  }, [favorites.length]);

  const selectedCount = selectedIds.size;

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

  function handleRemove(id: string) {
    setRemoveError(null);
    const previous = favorites;
    setFavorites((current) => current.filter((event) => event.id !== id));
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
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
            Mon compte
          </p>
          <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
            Vos détours
          </h1>
          <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
            Les sorties que vous gardez sous la main — à retrouver ici, ou à
            glisser dans votre agenda.
          </p>
        </div>

        <div className="shrink-0 md:pb-1 md:text-right">
          <p className="font-display text-lg tracking-tight text-ink">
            {user.name}
          </p>
          <p className="mt-1 text-[12px] text-sand">{user.email}</p>
          <p className="mt-3 text-[12px] uppercase tracking-[0.12em] text-sand">
            {countLabel}
          </p>
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
      </div>

      {removeError ? (
        <p className="mt-6 text-sm text-coral" role="alert">
          {removeError}
        </p>
      ) : null}

      <AccountGroupsSection groups={groups} onGroupsChange={setGroups} />

      {favorites.length === 0 ? (
        <div className="mt-10 md:mt-14">
          <AccountEmptyFavorites />
        </div>
      ) : (
        <div className="mt-10 md:mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
            <h2 className="font-display text-[1.35rem] tracking-tight text-ink md:text-[1.5rem]">
              Favoris
            </h2>
            <div className="flex items-center gap-4">
              {selectionMode ? (
                <p
                  className="text-[12px] uppercase tracking-[0.12em] text-sand"
                  aria-live="polite"
                >
                  {selectedCount === 0
                    ? "Aucun sélectionné"
                    : `${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""}`}
                </p>
              ) : (
                <p className="text-[12px] uppercase tracking-[0.12em] text-sand">
                  {countLabel}
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  selectionMode ? exitSelectionMode() : enterSelectionMode()
                }
                className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline decoration-line underline-offset-4 transition-colors hover:text-coral"
              >
                {selectionMode ? "Annuler" : "Sélectionner"}
              </button>
            </div>
          </div>

          <div>
            {favorites.map((event) => (
              <AccountFavoriteCard
                key={event.id}
                event={event}
                onRemove={handleRemove}
                onAddToGroup={
                  selectionMode ? undefined : handleOpenAddToGroup
                }
                secondaryInMenu
                selectionMode={selectionMode}
                selected={selectedIds.has(event.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </div>
      )}

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
              Ajouter à un groupe
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
          onClose={() => setGroupModal(null)}
          onGroupsChange={setGroups}
          onSuccess={
            groupModal.kind === "bulk" ? exitSelectionMode : undefined
          }
        />
      ) : null}
    </div>
  );
}
