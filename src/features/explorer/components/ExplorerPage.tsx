"use client";

import { OrganizeInCarnetModal } from "@/components/carnets/OrganizeInCarnetModal";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { Header } from "@/components/layout/Header";
import { PendingFavoriteAfterAuthGate } from "@/components/favorites/PendingFavoriteAfterAuthGate";
import { FavoriteAuthModal } from "@/components/favorites/FavoriteAuthModal";
import { usePersonalData } from "@/components/personal/usePersonalData";
import { useEventPersonalActions } from "@/components/personal/useEventPersonalActions";
import {
  ExplorerSection,
  type ExplorerInitialPage,
} from "@/features/explorer/components/ExplorerSection";
import { authClient } from "@/lib/auth-client";

type ExplorerPageProps = {
  explorer: ExplorerInitialPage;
};

export function ExplorerPage({ explorer }: ExplorerPageProps) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const headerUser =
    userId && session?.user
      ? {
          name: session.user.name ?? "",
          email: session.user.email ?? "",
        }
      : null;

  const personal = usePersonalData({
    userId,
    isSessionPending,
    loadCarnets: true,
  });

  const actions = useEventPersonalActions({
    userId,
    isSessionPending,
    returnPath: "/explorer",
    favorites: personal.favorites,
    addFavoriteLocally: personal.addFavoriteLocally,
    rollbackFavoriteAdd: personal.rollbackFavoriteAdd,
    removeFavoriteLocally: personal.removeFavoriteLocally,
  });

  return (
    <div id="top" className="min-h-screen bg-paper">
      <Header
        homeHref="/"
        favoriteCount={personal.favorites.size}
        user={headerUser}
        showFriseNav={actions.isAuthenticated}
      />
      {actions.isAuthenticated ? (
        <PendingFavoriteAfterAuthGate
          enabled
          onFavoriteSaved={actions.handlePendingFavoriteSaved}
        />
      ) : null}
      <main>
        {actions.favoriteError || actions.removeError ? (
          <div className="border-b border-line px-5 py-3 md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
            <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-coral" role="alert">
                {actions.favoriteError || actions.removeError}
              </p>
              <button
                type="button"
                onClick={actions.clearErrors}
                className="text-[12px] text-sand underline decoration-line underline-offset-4 hover:text-ink"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : null}
        <ExplorerSection
          initial={explorer}
          favorites={personal.favorites as Set<string>}
          onToggleFavorite={actions.toggleFavorite}
          carnetCounts={personal.carnetCounts as Map<string, number>}
          onOrganizeCarnets={
            actions.isAuthenticated ? actions.handleOrganizeCarnets : undefined
          }
          onOpenDetail={actions.openEventDetail}
        />
      </main>
      {actions.detail ? (
        <EventDetailModal
          event={actions.detail.event}
          surface={actions.detail.surface}
          onClose={actions.closeEventDetail}
          returnFocusTo={actions.detail.trigger}
        />
      ) : null}
      {actions.organizeEvent && personal.hasCarnetsState && userId ? (
        <OrganizeInCarnetModal
          event={actions.organizeEvent}
          groups={personal.groups}
          memberships={personal.memberships}
          isFavorite={personal.favorites.has(actions.organizeEvent.id)}
          onClose={actions.closeOrganizeModal}
          returnFocusTo={actions.organizeTrigger}
          onGroupsChange={personal.replaceGroups}
          onMembershipsChange={(next) =>
            personal.replaceMemberships([actions.organizeEvent!.id], next)
          }
          onFavoriteAdded={personal.addFavoriteLocally}
          onFavoriteRemoved={personal.removeFavoriteLocally}
        />
      ) : null}
      {actions.authFavoriteEventId ? (
        <FavoriteAuthModal
          eventId={actions.authFavoriteEventId}
          returnPath={actions.returnPath}
          onClose={actions.closeFavoriteAuth}
          returnFocusTo={actions.authFavoriteTrigger}
        />
      ) : null}
      {actions.removeConfirmation}
      <footer className="border-t border-line px-5 py-10 md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="font-display text-4xl tracking-tight">
            Détour<span className="text-coral">.</span>
          </p>
          <p className="max-w-md text-sm leading-6 text-sand">
            Explorer les sorties autour d’Orléans — filtres, recherche et
            pagination.
          </p>
        </div>
      </footer>
    </div>
  );
}
