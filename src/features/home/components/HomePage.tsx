"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addFavorite,
  listMyFavoriteEventIds,
  removeFavorite,
} from "@/app/actions/favorites";
import { DetourSection } from "@/features/home/components/DetourSection";
import {
  ExplorerSection,
  type ExplorerInitialPage,
} from "@/features/home/components/ExplorerSection";
import { Header } from "@/components/layout/Header";
import { HeroFilters } from "@/features/home/components/HeroFilters";
import { authClient } from "@/features/account/auth-client";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import type { EventItem } from "@/data/types";

const HomeDebugSection = dynamic(
  () =>
    import("@/features/home/debug/HomeDebugSection").then((mod) => mod.HomeDebugSection),
  { ssr: false },
);

/** Jamais muté — état public initial / anonyme. */
const EMPTY_FAVORITES: ReadonlySet<string> = new Set();

const HOME_PERF = "[detour:home-perf]";

function homePerfClient(message: string): void {
  // Temporaire diagnostic — pas de PII (pas d’userId / email).
  console.info(`${HOME_PERF} client ${message}`);
}

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

export function HomePage({
  highlights,
  planningEvents: _planningEvents,
  explorer,
  debugEvents,
  debugMeta,
}: HomePageProps) {
  const mountAtRef = useRef<number | null>(null);
  if (mountAtRef.current === null && typeof performance !== "undefined") {
    mountAtRef.current = performance.now();
  }

  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const isAuthenticated = Boolean(userId);
  const accountLabel = isAuthenticated ? "Mon compte" : "Se connecter";

  const [favoriteState, setFavoriteState] = useState<FavoriteState | null>(null);
  const [authPrompt, setAuthPrompt] = useState(false);
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

  useEffect(() => {
    const t0 = mountAtRef.current ?? performance.now();
    homePerfClient(
      `hydrate_mount +${(performance.now() - t0).toFixed(0)}ms highlights=${highlights.length} explorer=${explorer.events.length}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount probe
  }, []);

  useEffect(() => {
    const t0 = mountAtRef.current ?? 0;
    homePerfClient(
      `session pending=${isSessionPending} authenticated=${isAuthenticated} +${(performance.now() - t0).toFixed(0)}ms`,
    );
  }, [isSessionPending, isAuthenticated]);

  useEffect(() => {
    if (isSessionPending || !userId) return;

    let cancelled = false;
    const t0 = mountAtRef.current ?? performance.now();
    const fetchStarted = performance.now();
    homePerfClient(`favorites_fetch_start +${(fetchStarted - t0).toFixed(0)}ms`);

    void listMyFavoriteEventIds().then((result) => {
      if (cancelled) return;
      const elapsed = performance.now() - fetchStarted;
      const count = result.ok ? result.eventIds.length : 0;
      homePerfClient(
        `favorites_fetch_end ok=${result.ok} count=${count} duration_ms=${elapsed.toFixed(0)} +${(performance.now() - t0).toFixed(0)}ms`,
      );
      setFavoriteState({
        userId,
        ids: new Set(result.ok ? result.eventIds : []),
      });
      homePerfClient(
        `favorites_state_applied count=${count} +${(performance.now() - t0).toFixed(0)}ms`,
      );
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

  function toggleFavorite(id: string) {
    setFavoriteError(null);

    if (isSessionPending) return;

    if (!isAuthenticated || !userId) {
      setAuthPrompt(true);
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
        setAuthPrompt(true);
        return;
      }
      setFavoriteError(
        "Impossible d’enregistrer ce détour. Réessayez.",
      );
    });
  }

  return (
    <div id="top" className="min-h-screen bg-paper">
      <Header favoriteCount={favorites.size} accountLabel={accountLabel} />
      <main>
        {authPrompt || favoriteError ? (
          <div className="border-b border-line px-5 py-3 md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
            <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-wrap items-center justify-between gap-3">
              {authPrompt ? (
                <p className="text-sm text-cream-dim">
                  Connectez-vous pour enregistrer ce détour.{" "}
                  <Link
                    href="/account/login"
                    className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral"
                  >
                    Se connecter
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-coral" role="alert">
                  {favoriteError}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setAuthPrompt(false);
                  setFavoriteError(null);
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
        />
        <ExplorerSection
          initial={explorer}
          favorites={favorites as Set<string>}
          onToggleFavorite={toggleFavorite}
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
