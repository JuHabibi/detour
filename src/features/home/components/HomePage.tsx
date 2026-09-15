"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  addFavorite,
  removeFavorite,
} from "@/app/actions/favorites";
import { DetourSection } from "@/features/home/components/DetourSection";
import {
  ExplorerSection,
  type ExplorerInitialPage,
} from "@/features/home/components/ExplorerSection";
import { Header } from "@/components/layout/Header";
import { HeroFilters } from "@/features/home/components/HeroFilters";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import type { EventItem } from "@/data/types";

const HomeDebugSection = dynamic(
  () =>
    import("@/features/home/debug/HomeDebugSection").then((mod) => mod.HomeDebugSection),
  { ssr: false },
);

type HomePageProps = {
  /** Label Header Account — déterminé côté serveur (session). */
  accountLabel: string;
  /** Session connue côté serveur (pour ne pas persister silencieusement hors compte). */
  isAuthenticated: boolean;
  /** IDs favoris persistés (vide si non connecté). */
  favoriteEventIds: string[];
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
  accountLabel,
  isAuthenticated,
  favoriteEventIds,
  highlights,
  planningEvents: _planningEvents,
  explorer,
  debugEvents,
  debugMeta,
}: HomePageProps) {
  const [favorites, setFavorites] = useState(
    () => new Set(favoriteEventIds),
  );
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

  if (debugMeta !== prevDebugMeta) {
    setPrevDebugMeta(debugMeta);
    setLiveDebugMeta(debugMeta);
    setOverrideHighlights(null);
    setOverridePlanning(null);
  }

  const displayedHighlights = overrideHighlights ?? highlights;

  function toggleFavorite(id: string) {
    setFavoriteError(null);

    if (!isAuthenticated) {
      setAuthPrompt(true);
      return;
    }

    const wasFavorite = favorites.has(id);
    setFavorites((current) => {
      const next = new Set(current);
      if (wasFavorite) next.delete(id);
      else next.add(id);
      return next;
    });

    startTransition(async () => {
      const result = wasFavorite
        ? await removeFavorite(id)
        : await addFavorite(id);

      if (result.ok) return;

      setFavorites((current) => {
        const next = new Set(current);
        if (wasFavorite) next.add(id);
        else next.delete(id);
        return next;
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
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
        <ExplorerSection
          initial={explorer}
          favorites={favorites}
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
