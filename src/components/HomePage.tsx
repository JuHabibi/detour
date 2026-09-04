"use client";

import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DetourSection } from "@/components/DetourSection";
import { EventGrid } from "@/components/EventGrid";
import { Header } from "@/components/Header";
import { HeroFilters } from "@/components/HeroFilters";
import { UpcomingSection } from "@/components/UpcomingSection";
import { EventsDebugPanel } from "@/components/EventsDebugPanel";
import type { EventsDebugMeta } from "@/components/EventsDebugPanel";
import type {
  CategoryId,
  EventItem,
  RadiusFilter,
  WhenFilter,
} from "@/data/types";

const PAGE_SIZE = 12;

type HomePageProps = {
  events: EventItem[];
  debugMeta?: EventsDebugMeta;
};

export function HomePage({ events, debugMeta }: HomePageProps) {
  const [when, setWhen] = useState<WhenFilter>("weekend");
  const [radius, setRadius] = useState<RadiusFilter>(15);
  const [category, setCategory] = useState<CategoryId>("tout");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Distance absente = pas encore filtrable ; on n’exclut pas l’événement.
  const withinRadius = useMemo(
    () =>
      events.filter(
        (event) =>
          event.distanceKm == null || event.distanceKm <= radius,
      ),
    [events, radius],
  );

  // Sections temporaires basées sur la chronologie / le calendrier,
  // pas sur un ranking éditorial (à venir dans EventService).
  const detourEvents = useMemo(
    () => withinRadius.slice(0, 4),
    [withinRadius],
  );

  const weekendEvents = useMemo(
    () =>
      withinRadius.filter((event) => {
        if (category !== "tout" && event.category !== category) return false;
        if (when === "weekend") return Boolean(event.weekend);
        return true;
      }),
    [withinRadius, category, when],
  );

  const visibleWeekendEvents = weekendEvents.slice(0, visibleCount);
  const canShowMore = visibleCount < weekendEvents.length;

  const upcomingEvents = useMemo(
    () => withinRadius.filter((event) => !event.weekend).slice(0, 4),
    [withinRadius],
  );

  function handleWhenChange(value: WhenFilter) {
    setWhen(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleCategoryChange(value: CategoryId) {
    setCategory(value);
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
        <HeroFilters
          when={when}
          radius={radius}
          onWhenChange={handleWhenChange}
          onRadiusChange={setRadius}
        />
        <DetourSection
          events={detourEvents}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
        <CategoryFilter
          category={category}
          onCategoryChange={handleCategoryChange}
        />
        <EventGrid
          title="Ce week-end autour de vous"
          events={visibleWeekendEvents}
          totalCount={weekendEvents.length}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onShowMore={
            canShowMore
              ? () => setVisibleCount((current) => current + PAGE_SIZE)
              : undefined
          }
        />
        <UpcomingSection
          events={upcomingEvents}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
        <EventsDebugPanel events={events} meta={debugMeta} />
      </main>
      <footer className="border-t border-line px-5 py-10 md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="font-display text-3xl">
            Détour<span className="text-coral">.</span>
          </p>
          <p className="max-w-md text-sm leading-6 text-sand">
            Ce que vous auriez pu rater autour de vous. Pas un agenda : une
            invitation à sortir.
          </p>
        </div>
      </footer>
    </div>
  );
}
