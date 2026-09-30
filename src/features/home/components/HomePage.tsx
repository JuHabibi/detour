"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  addFavorite,
  listMyFavoriteEventIds,
  removeFavorite,
} from "@/app/actions/favorites";
import { listMyCarnetsState } from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import { OrganizeInCarnetModal } from "@/components/carnets/OrganizeInCarnetModal";
import { countCarnetsByEventId } from "@/components/carnets/count-carnets-by-event-id";
import {
  EventDetailModal,
  type EventDetailSurface,
} from "@/components/event/EventDetailModal";
import { Header } from "@/components/layout/Header";
import { PendingFavoriteAfterAuthGate } from "@/components/favorites/PendingFavoriteAfterAuthGate";
import { FavoriteAuthModal } from "@/features/home/components/FavoriteAuthModal";
import { HeroFilters } from "@/features/home/components/HeroFilters";
import {
  ExplorerSection,
  type ExplorerInitialPage,
} from "@/features/home/components/explorer/ExplorerSection";
import { DetourSection } from "@/features/home/components/radar/DetourSection";
import { resolveRadarPickReason } from "@/features/home/resolve-radar-pick-reason";
import { authClient } from "@/lib/auth-client";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import type { EventItem } from "@/data/types";
const HomeDebugSection = dynamic(
  () =>
    import("@/features/home/debug/HomeDebugSection").then((mod) => mod.HomeDebugSection),
  { ssr: false },
);

/** Jamais muté — état public initial / anonyme. */
const EMPTY_FAVORITES: ReadonlySet<string> = new Set();
const EMPTY_CARNET_COUNTS: ReadonlyMap<string, number> = new Map();

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

type FavoriteState = {
  userId: string;
  ids: Set<string>;
};

type CarnetsState = {
  userId: string;
  groups: GroupSummary[];
  memberships: EventGroupMembership[];
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

  const [favoriteState, setFavoriteState] = useState<FavoriteState | null>(null);
  const [carnetsState, setCarnetsState] = useState<CarnetsState | null>(null);
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

  useEffect(() => {
    if (isSessionPending || !userId) {
      setCarnetsState(null);
      return;
    }

    let cancelled = false;
    setCarnetsState((prev) =>
      prev?.userId === userId ? prev : { userId, groups: [], memberships: [] },
    );

    void listMyFavoriteEventIds().then((result) => {
      if (cancelled) return;
      setFavoriteState({
        userId,
        ids: new Set(result.ok ? result.eventIds : []),
      });
    });

    void listMyCarnetsState().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setCarnetsState({ userId, groups: [], memberships: [] });
        return;
      }
      setCarnetsState({
        userId,
        groups: result.groups,
        memberships: result.memberships,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isSessionPending, userId]);

  if (debugMeta !== prevDebugMeta) {
    setPrevDebugMeta(debugMeta);
    setLiveDebugMeta(debugMeta);
    setOverrideHighlights(null);
    setOverridePlanning(null);
  }

  const favorites: ReadonlySet<string> =
    userId && favoriteState?.userId === userId
      ? favoriteState.ids
      : EMPTY_FAVORITES;

  const sessionCarnets =
    userId && carnetsState?.userId === userId ? carnetsState : null;

  const carnetCounts = useMemo(() => {
    if (!sessionCarnets) return EMPTY_CARNET_COUNTS;
    return countCarnetsByEventId(sessionCarnets.memberships);
  }, [sessionCarnets]);

  const displayedHighlights = overrideHighlights ?? highlights;

  function patchFavorites(mutator: (draft: Set<string>) => void) {
    if (!userId) return;
    setFavoriteState((prev) => {
      const draft =
        prev?.userId === userId ? new Set(prev.ids) : new Set<string>();
      mutator(draft);
      return { userId, ids: draft };
    });
  }

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

    if (isSessionPending) return;
    if (!isAuthenticated || !userId) {
      openFavoriteAuth(id);
      return;
    }

    const wasFavorite = favorites.has(id);
    patchFavorites((draft) => {
      if (wasFavorite) draft.delete(id);
      else draft.add(id);
    });

    startTransition(async () => {
      const result = wasFavorite
        ? await removeFavorite(id)
        : await addFavorite(id);

      if (result.ok) return;

      patchFavorites((draft) => {
        if (wasFavorite) draft.add(id);
        else draft.delete(id);
      });

      if (result.reason === "unauthenticated") {
        openFavoriteAuth(id);
        return;
      }
      setFavoriteError(
        "Impossible d’enregistrer ce détour. Réessayez.",
      );
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

  const handlePendingFavoriteSaved = useCallback((eventId: string) => {
    if (!userId) return;
    setFavoriteState((prev) => {
      const draft =
        prev?.userId === userId ? new Set(prev.ids) : new Set<string>();
      draft.add(eventId);
      return { userId, ids: draft };
    });
  }, [userId]);

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
        {favoriteError ? (
          <div className="border-b border-line px-5 py-3 md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
            <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-coral" role="alert">
                {favoriteError}
              </p>
              <button
                type="button"
                onClick={() => setFavoriteError(null)}
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
      {organizeEvent && sessionCarnets && userId ? (
        <OrganizeInCarnetModal
          event={organizeEvent}
          groups={sessionCarnets.groups}
          memberships={sessionCarnets.memberships}
          isFavorite={favorites.has(organizeEvent.id)}
          onClose={closeOrganizeModal}
          returnFocusTo={organizeTrigger}
          onGroupsChange={(groups) =>
            setCarnetsState((prev) =>
              prev?.userId === userId ? { ...prev, groups } : prev,
            )
          }
          onMembershipsChange={(memberships) =>
            setCarnetsState((prev) =>
              prev?.userId === userId ? { ...prev, memberships } : prev,
            )
          }
          onFavoriteAdded={(eventId) => {
            patchFavorites((draft) => {
              draft.add(eventId);
            });
          }}
          onFavoriteRemoved={(eventId) => {
            patchFavorites((draft) => {
              draft.delete(eventId);
            });
            setCarnetsState((prev) => {
              if (prev?.userId !== userId) return prev;
              return {
                ...prev,
                memberships: prev.memberships.filter(
                  (m) => m.eventId !== eventId,
                ),
              };
            });
          }}
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
