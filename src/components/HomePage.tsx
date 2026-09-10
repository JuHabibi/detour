"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { DetourSection } from "@/components/DetourSection";
import {
  ExplorerSection,
  type ExplorerInitialPage,
} from "@/components/ExplorerSection";
import { Header } from "@/components/Header";
import { HeroFilters } from "@/components/HeroFilters";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import type { EventItem } from "@/data/types";

const HomeDebugSection = dynamic(
  () =>
    import("@/components/HomeDebugSection").then((mod) => mod.HomeDebugSection),
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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
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
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div id="top" className="min-h-screen bg-paper">
      <Header favoriteCount={favorites.size} />
      <main>
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
      <footer className="border-t border-line px-5 py-10 md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="font-display text-4xl tracking-tight">
            Détour<span className="text-coral">.</span>
          </p>
          <p className="max-w-md text-sm leading-6 text-sand">
            Radar culturel local — pour repérer ce qui mérite votre attention,
            pas pour tout lister.
          </p>
        </div>
      </footer>
    </div>
  );
}
