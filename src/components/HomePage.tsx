"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DetourSection } from "@/components/DetourSection";
import { EventGrid } from "@/components/EventGrid";
import { ExplorationFilters } from "@/components/ExplorationFilters";
import { Header } from "@/components/Header";
import { HeroFilters } from "@/components/HeroFilters";
import type { EventsDebugMeta } from "@/components/EventsDebugPanel";
import {
  isEventInWhenFilter,
  type WhenFilter,
} from "@/domain/time/when-filter";
import type { CategoryId, EventItem, RadiusFilter } from "@/data/types";

const PAGE_SIZE = 12;

const HomeDebugSection = dynamic(
  () =>
    import("@/components/HomeDebugSection").then((mod) => mod.HomeDebugSection),
  { ssr: false },
);

const GRID_RESULT_TITLES: Record<WhenFilter, string> = {
  today: "Aujourd’hui autour d’Orléans",
  tomorrow: "Demain autour d’Orléans",
  weekend: "Ce week-end autour d’Orléans",
  "next-week": "Semaine prochaine autour d’Orléans",
  "this-month": "Ce mois-ci autour d’Orléans",
  "next-month": "Mois prochain autour d’Orléans",
  upcoming: "À venir autour d’Orléans",
};

type HomePageProps = {
  events: EventItem[];
  /** Highlights radar — indépendants des filtres d’exploration. */
  highlights: EventItem[];
  /**
   * Sélection planning métier — conservée (debug / futurs usages).
   * Section publique masquée temporairement.
   */
  planningEvents: EventItem[];
  /** Absent en production — panneau debug non monté. */
  debugMeta?: EventsDebugMeta;
};

export function HomePage({
  events,
  highlights,
  planningEvents: _planningEvents,
  debugMeta,
}: HomePageProps) {
  const [when, setWhen] = useState<WhenFilter>("weekend");
  const [radius, setRadius] = useState<RadiusFilter>(15);
  const [category, setCategory] = useState<CategoryId>("tout");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [overrideHighlights, setOverrideHighlights] = useState<EventItem[] | null>(
    null,
  );
  const [overridePlanning, setOverridePlanning] = useState<EventItem[] | null>(
    null,
  );
  const [liveDebugMeta, setLiveDebugMeta] = useState(debugMeta);

  useEffect(() => {
    setLiveDebugMeta(debugMeta);
    setOverrideHighlights(null);
    setOverridePlanning(null);
  }, [debugMeta]);

  const displayedHighlights = overrideHighlights ?? highlights;

  // Distance absente = pas encore filtrable ; on n’exclut pas l’événement.
  const withinRadius = useMemo(
    () =>
      events.filter(
        (event) =>
          event.distanceKm == null || event.distanceKm <= radius,
      ),
    [events, radius],
  );

  const filteredEvents = useMemo(() => {
    const now = new Date();
    return withinRadius.filter((event) => {
      if (category !== "tout" && event.category !== category) return false;
      if (!event.startAt) return false;
      return isEventInWhenFilter(event.startAt, event.endAt, when, now);
    });
  }, [withinRadius, category, when]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const canShowMore = visibleCount < filteredEvents.length;

  function handleWhenChange(value: WhenFilter) {
    setWhen(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleCategoryChange(value: CategoryId) {
    setCategory(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleRadiusChange(value: RadiusFilter) {
    setRadius(value);
    setVisibleCount(PAGE_SIZE);
  }

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
        <EventGrid
          title="Explorer les sorties"
          resultTitle={GRID_RESULT_TITLES[when]}
          toolbar={
            <>
              <ExplorationFilters
                when={when}
                radius={radius}
                onWhenChange={handleWhenChange}
                onRadiusChange={handleRadiusChange}
              />
              <CategoryFilter
                category={category}
                onCategoryChange={handleCategoryChange}
              />
            </>
          }
          events={visibleEvents}
          totalCount={filteredEvents.length}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onShowMore={
            canShowMore
              ? () => setVisibleCount((current) => current + PAGE_SIZE)
              : undefined
          }
        />
        {liveDebugMeta ? (
          <HomeDebugSection
            events={events}
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
          <p className="font-display text-3xl">
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
