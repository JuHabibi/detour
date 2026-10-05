"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, useTransition } from "react";
import { addFavorite } from "@/app/actions/favorites";
import { OrganizeInCarnetModal } from "@/components/carnets/OrganizeInCarnetModal";
import {
  EventDetailModal,
  type EventDetailSurface,
} from "@/components/event/EventDetailModal";
import { Header } from "@/components/layout/Header";
import { PendingFavoriteAfterAuthGate } from "@/components/favorites/PendingFavoriteAfterAuthGate";
import { useRemoveFavorite } from "@/components/favorites/useRemoveFavorite";
import { FavoriteAuthModal } from "@/features/home/components/FavoriteAuthModal";
import { HeroFilters } from "@/features/home/components/HeroFilters";
import {
  ExplorerSection,
  type ExplorerInitialPage,
} from "@/features/home/components/explorer/ExplorerSection";
import { DetourSection } from "@/features/home/components/radar/DetourSection";
import { usePersonalData } from "@/components/personal/usePersonalData";
import { resolveRadarPickReason } from "@/features/home/resolve-radar-pick-reason";
import { authClient } from "@/lib/auth-client";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import type { EventItem } from "@/data/types";

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
  /** Première page Explorer (read model DB). */
  explorer: ExplorerInitialPage;
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
  explorer,
  debugEvents,
  debugMeta,
}: HomePageProps) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const isAuthenticated = Boolean(userId);
  const headerUser =
    isAuthenticated && session?.user
      ? {
          name: session.user.name ?? "",
          email: session.user.email ?? "",
        }
      : null;

  const {
    favorites,
    groups,
    memberships,
    carnetCounts,
    hasCarnetsState,
    addFavoriteLocally,
    rollbackFavoriteAdd,
    removeFavoriteLocally,
    replaceGroups,
    replaceMemberships,
  } = usePersonalData({ userId, isSessionPending, loadCarnets: true });

  const [organizeEvent, setOrganizeEvent] = useState<EventItem | null>(null);
  const [organizeTrigger, setOrganizeTrigger] = useState<HTMLElement | null>(
    null,
  );
  const [authFavoriteEventId, setAuthFavoriteEventId] = useState<string | null>(
    null,
  );
  const [authFavoriteTrigger, setAuthFavoriteTrigger] =
    useState<HTMLElement | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const {
    requestRemove,
    confirmation: removeConfirmation,
    error: removeError,
    clearError: clearRemoveError,
  } = useRemoveFavorite({
    onRemoved: removeFavoriteLocally,
    onUnauthenticated: openFavoriteAuth,
  });
  const [overrideHighlights, setOverrideHighlights] = useState<EventItem[] | null>(
    null,
  );
  const [overridePlanning, setOverridePlanning] = useState<EventItem[] | null>(
    null,
  );
  const [liveDebugMeta, setLiveDebugMeta] = useState(debugMeta);
  const [prevDebugMeta, setPrevDebugMeta] = useState(debugMeta);
  const [detail, setDetail] = useState<{
    event: EventItem;
    surface: EventDetailSurface;
    trigger: HTMLElement | null;
  } | null>(null);

  const openEventDetail = useCallback(
    (
      event: EventItem,
      surface: EventDetailSurface,
      trigger: HTMLElement,
    ) => {
      setDetail({ event, surface, trigger });
    },
    [],
  );

  const closeEventDetail = useCallback(() => {
    setDetail(null);
  }, []);

  if (debugMeta !== prevDebugMeta) {
    setPrevDebugMeta(debugMeta);
    setLiveDebugMeta(debugMeta);
    setOverrideHighlights(null);
    setOverridePlanning(null);
  }

  const displayedHighlights = overrideHighlights ?? highlights;

  function openFavoriteAuth(eventId: string) {
    setAuthFavoriteTrigger(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    setAuthFavoriteEventId(eventId);
  }

  function closeFavoriteAuth() {
    setAuthFavoriteEventId(null);
    setAuthFavoriteTrigger(null);
  }

  function toggleFavorite(id: string) {
    setFavoriteError(null);
    clearRemoveError();

    if (isSessionPending) return;
    if (!isAuthenticated || !userId) {
      openFavoriteAuth(id);
      return;
    }

    if (favorites.has(id)) {
      requestRemove(id);
      return;
    }

    addFavoriteLocally(id);

    startTransition(async () => {
      try {
        const result = await addFavorite(id);

        if (result.ok) return;

        rollbackFavoriteAdd(id);

        if (result.reason === "unauthenticated") {
          openFavoriteAuth(id);
          return;
        }
        setFavoriteError("Impossible d’enregistrer ce détour. Réessayez.");
      } catch (error) {
        console.error("[detour:home] toggleFavorite failed", error);
        rollbackFavoriteAdd(id);
        setFavoriteError("Impossible d’enregistrer ce détour. Réessayez.");
      }
    });
  }

  function handleOrganizeCarnets(event: EventItem) {
    if (isSessionPending) return;
    if (!isAuthenticated || !userId) {
      openFavoriteAuth(event.id);
      return;
    }
    setOrganizeTrigger(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    setOrganizeEvent(event);
  }

  function closeOrganizeModal() {
    setOrganizeEvent(null);
    setOrganizeTrigger(null);
  }

  const handlePendingFavoriteSaved = useCallback(
    (eventId: string) => {
      addFavoriteLocally(eventId);
    },
    [addFavoriteLocally],
  );

  return (
    <div id="top" className="min-h-screen bg-paper">
      <Header
        favoriteCount={favorites.size}
        user={headerUser}
        showFriseNav={isAuthenticated}
      />
      {isAuthenticated ? (
        <PendingFavoriteAfterAuthGate
          enabled
          onFavoriteSaved={handlePendingFavoriteSaved}
        />
      ) : null}
      <main>
        {favoriteError || removeError ? (
          <div className="border-b border-line px-5 py-3 md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
            <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-coral" role="alert">
                {favoriteError || removeError}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFavoriteError(null);
                  clearRemoveError();
                }}
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
          favorites={favorites as Set<string>}
          onToggleFavorite={toggleFavorite}
          carnetCounts={carnetCounts as Map<string, number>}
          onOrganizeCarnets={
            isAuthenticated ? handleOrganizeCarnets : undefined
          }
          onOpenDetail={openEventDetail}
        />
        <ExplorerSection
          initial={explorer}
          favorites={favorites as Set<string>}
          onToggleFavorite={toggleFavorite}
          carnetCounts={carnetCounts as Map<string, number>}
          onOrganizeCarnets={
            isAuthenticated ? handleOrganizeCarnets : undefined
          }
          onOpenDetail={openEventDetail}
        />
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
      {detail ? (
        <EventDetailModal
          event={detail.event}
          surface={detail.surface}
          onClose={closeEventDetail}
          returnFocusTo={detail.trigger}
          radarPickReason={
            detail.surface === "radar"
              ? resolveRadarPickReason(detail.event)
              : null
          }
        />
      ) : null}
      {organizeEvent && hasCarnetsState && userId ? (
        <OrganizeInCarnetModal
          event={organizeEvent}
          groups={groups}
          memberships={memberships}
          isFavorite={favorites.has(organizeEvent.id)}
          onClose={closeOrganizeModal}
          returnFocusTo={organizeTrigger}
          onGroupsChange={replaceGroups}
          onMembershipsChange={replaceMemberships}
          onFavoriteAdded={addFavoriteLocally}
          onFavoriteRemoved={removeFavoriteLocally}
        />
      ) : null}
      {authFavoriteEventId ? (
        <FavoriteAuthModal
          eventId={authFavoriteEventId}
          returnPath="/"
          onClose={closeFavoriteAuth}
          returnFocusTo={authFavoriteTrigger}
        />
      ) : null}
      {removeConfirmation}
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
