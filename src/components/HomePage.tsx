"use client";

import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DetourSection } from "@/components/DetourSection";
import { EventGrid } from "@/components/EventGrid";
import { Header } from "@/components/Header";
import { HeroFilters } from "@/components/HeroFilters";
import { UpcomingSection } from "@/components/UpcomingSection";
import type {
  CategoryId,
  EventItem,
  RadiusFilter,
  WhenFilter,
} from "@/data/types";

type HomePageProps = {
  events: EventItem[];
};

export function HomePage({ events }: HomePageProps) {
  const [when, setWhen] = useState<WhenFilter>("weekend");
  const [radius, setRadius] = useState<RadiusFilter>(15);
  const [category, setCategory] = useState<CategoryId>("tout");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const withinRadius = useMemo(
    () => events.filter((event) => event.distanceKm <= radius),
    [events, radius],
  );

  const detourEvents = useMemo(() => {
    const selected = withinRadius.filter((event) => event.detour);
    if (selected.length >= 2) return selected.slice(0, 4);
    return events.filter((event) => event.detour).slice(0, 4);
  }, [events, withinRadius]);

  const weekendEvents = useMemo(
    () =>
      withinRadius.filter((event) => {
        if (event.upcoming) return false;
        if (category !== "tout" && event.category !== category) return false;
        if (when === "weekend") return Boolean(event.weekend);
        return !event.detour || Boolean(event.weekend);
      }),
    [withinRadius, category, when],
  );

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.upcoming).slice(0, 4),
    [events],
  );

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
          onWhenChange={setWhen}
          onRadiusChange={setRadius}
        />
        <DetourSection
          events={detourEvents}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
        <CategoryFilter
          category={category}
          onCategoryChange={setCategory}
        />
        <EventGrid
          title="Ce week-end autour de vous"
          events={weekendEvents}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
        <UpcomingSection
          events={upcomingEvents}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
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
