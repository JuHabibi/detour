"use client";

import dynamic from "next/dynamic";
import { OrganizeInCarnetModal } from "@/components/carnets/OrganizeInCarnetModal";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { Header } from "@/components/layout/Header";
import { PendingFavoriteAfterAuthGate } from "@/components/favorites/PendingFavoriteAfterAuthGate";
import { FavoriteAuthModal } from "@/components/favorites/FavoriteAuthModal";
import { usePersonalData } from "@/components/personal/usePersonalData";
import { useEventPersonalActions } from "@/components/personal/useEventPersonalActions";
import { HeroFilters } from "@/features/home/components/HeroFilters";
import { HomeExplorerCta } from "@/features/home/components/HomeExplorerCta";
import { DetourSection } from "@/features/home/components/radar/DetourSection";
import { resolveRadarPickReason } from "@/features/home/resolve-radar-pick-reason";
import { authClient } from "@/lib/auth-client";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import type { EventItem } from "@/data/types";
import { useState } from "react";

const HomeDebugSection = dynamic(
  () =>
    import("@/features/home/debug/HomeDebugSection").then(
      (mod) => mod.HomeDebugSection,
    ),
  { ssr: false },
);

type HomePageProps = {
  /** Highlights radar — indépendants des filtres d’exploration. */
  highlights: EventItem[];
  /**
   * Sélection planning métier — conservée (debug / futurs usages).
   * Section publique masquée temporairement.
   */
  planningEvents: EventItem[];
  /**
   * Corpus complet pour le panneau debug uniquement.
   * Absent en production (`shouldExposeHomeDebug` false).
   */
  debugEvents?: EventItem[];
  /** Absent en production — panneau debug non monté. */
  debugMeta?: EventsDebugMeta;
};

export function HomePage({
  highlights,
  planningEvents: _planningEvents,
  debugEvents,
  debugMeta,
}: HomePageProps) {
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
    returnPath: "/",
    favorites: personal.favorites,
    addFavoriteLocally: personal.addFavoriteLocally,
    rollbackFavoriteAdd: personal.rollbackFavoriteAdd,
    removeFavoriteLocally: personal.removeFavoriteLocally,
  });

  const [overrideHighlights, setOverrideHighlights] = useState<EventItem[] | null>(
    null,
  );
  const [overridePlanning, setOverridePlanning] = useState<EventItem[] | null>(
    null,
  );
  const [liveDebugMeta, setLiveDebugMeta] = useState(debugMeta);
  const [prevDebugMeta, setPrevDebugMeta] = useState(debugMeta);

  if (debugMeta !== prevDebugMeta) {
    setPrevDebugMeta(debugMeta);
    setLiveDebugMeta(debugMeta);
    setOverrideHighlights(null);
    setOverridePlanning(null);
  }

  const displayedHighlights = overrideHighlights ?? highlights;

  return (
    <div id="top" className="min-h-screen bg-paper">
      <Header
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
        <HeroFilters />
        <DetourSection
          events={displayedHighlights}
          favorites={personal.favorites as Set<string>}
          onToggleFavorite={actions.toggleFavorite}
          carnetCounts={personal.carnetCounts as Map<string, number>}
          onOrganizeCarnets={
            actions.isAuthenticated ? actions.handleOrganizeCarnets : undefined
          }
          onOpenDetail={actions.openEventDetail}
        />
        <HomeExplorerCta />
        {liveDebugMeta && debugEvents ? (
          <HomeDebugSection
            events={debugEvents}
            meta={liveDebugMeta}
            onManualAiResult={({
              highlights: nextHighlights,
              planningEvents: nextPlanning,
              debugMeta: nextMeta,
            }) => {
              setOverrideHighlights(nextHighlights);
              setOverridePlanning(nextPlanning);
              setLiveDebugMeta(nextMeta);
            }}
          />
        ) : null}
      </main>
      {actions.detail ? (
        <EventDetailModal
          event={actions.detail.event}
          surface={actions.detail.surface}
          onClose={actions.closeEventDetail}
          returnFocusTo={actions.detail.trigger}
          radarPickReason={
            actions.detail.surface === "radar"
              ? resolveRadarPickReason(actions.detail.event)
              : null
          }
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
            Radar culturel local, pour repérer ce qui mérite votre attention,
            pas pour tout lister.
          </p>
        </div>
      </footer>
    </div>
  );
}
