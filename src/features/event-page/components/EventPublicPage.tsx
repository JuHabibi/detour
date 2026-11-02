"use client";

import { OrganizeInCarnetModal } from "@/components/carnets/OrganizeInCarnetModal";
import { CardFavoriteActions } from "@/components/event/EventCardInteractions";
import { FavoriteAuthModal } from "@/components/favorites/FavoriteAuthModal";
import { PendingFavoriteAfterAuthGate } from "@/components/favorites/PendingFavoriteAfterAuthGate";
import { Header } from "@/components/layout/Header";
import { useEventPersonalActions } from "@/components/personal/useEventPersonalActions";
import { usePersonalData } from "@/components/personal/usePersonalData";
import type { PublicEventPageData } from "@/application/events/get-public-event-page";
import { EventPublicView } from "@/features/event-page/components/EventPublicView";
import { eventPublicPath } from "@/lib/event-public-path";
import { authClient } from "@/lib/auth-client";
import { verifiedAuthUserId } from "@/lib/auth-session";

type EventPublicPageProps = {
  data: PublicEventPageData;
};

export function EventPublicPage({ data }: EventPublicPageProps) {
  const returnPath = eventPublicPath(data.eventId);
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const userId = verifiedAuthUserId(session);
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
    returnPath,
    favorites: personal.favorites,
    addFavoriteLocally: personal.addFavoriteLocally,
    rollbackFavoriteAdd: personal.rollbackFavoriteAdd,
    removeFavoriteLocally: personal.removeFavoriteLocally,
  });

  const isFavorite = personal.favorites.has(data.item.id);
  const carnetCount = personal.carnetCounts.get(data.item.id) ?? 0;

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
        {actions.favoriteError ||
        actions.removeError ||
        personal.favoritesError ||
        personal.carnetsError ? (
          <div className="border-b border-line px-5 py-3 md:px-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              {actions.favoriteError || actions.removeError ? (
                <p className="text-sm text-coral" role="alert">
                  {actions.favoriteError || actions.removeError}
                </p>
              ) : null}
              {personal.favoritesError || personal.carnetsError ? (
                <p className="text-sm text-coral" role="alert">
                  {personal.favoritesError || personal.carnetsError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <EventPublicView
          item={data.item}
          isEnded={data.isEnded}
          favoriteActions={
            <CardFavoriteActions
              event={data.item}
              isFavorite={isFavorite}
              onToggleFavorite={actions.toggleFavorite}
              carnetCount={carnetCount}
              onOrganizeCarnets={
                actions.isAuthenticated
                  ? actions.handleOrganizeCarnets
                  : undefined
              }
              className="border-0"
            />
          }
        />
      </main>

      {actions.organizeEvent &&
      personal.hasCarnetsState &&
      userId &&
      !(personal.carnetsError && personal.groups.length === 0) ? (
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
    </div>
  );
}
