"use client";

import { useMemo } from "react";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";
import { FeaturedEventsCarousel } from "@/features/home/components/radar/FeaturedEventsCarousel";
import { selectForYouEvents } from "./select-for-you-events";
import type { PersonalizationPreferences } from "./types";

type ForYouSectionProps = {
  pool: EventItem[];
  preferences: PersonalizationPreferences;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  carnetCounts?: Map<string, number>;
  onOrganizeCarnets?: (event: EventItem) => void;
  onOpenDetail?: OpenEventDetailHandler;
  onEditPreferences: () => void;
};

export function ForYouSection({
  pool,
  preferences,
  favorites,
  onToggleFavorite,
  carnetCounts,
  onOrganizeCarnets,
  onOpenDetail,
  onEditPreferences,
}: ForYouSectionProps) {
  const events = useMemo(
    () => selectForYouEvents(pool, preferences, 8),
    [pool, preferences],
  );

  if (events.length === 0) return null;

  return (
    <section
      id="pour-vous"
      aria-labelledby="for-you-title"
      className="scroll-mt-20 border-t border-line bg-paper"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 py-7 md:px-10 md:py-9 lg:px-16 2xl:px-20">
        <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
              Sélection personnelle
            </p>
            <h2
              id="for-you-title"
              className="mt-2 font-display text-[1.65rem] leading-[1.05] tracking-tight text-ink md:text-[2.1rem]"
            >
              ✦ Pour vous
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-cream-dim">
              Une piste selon vos préférences — en complément du Radar, sans le
              remplacer.
            </p>
          </div>
          <button
            type="button"
            onClick={onEditPreferences}
            className="inline-flex min-h-11 w-fit items-center border border-ink/25 bg-foam px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Modifier mes préférences
          </button>
        </div>

        <FeaturedEventsCarousel
          events={events}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          carnetCounts={carnetCounts}
          onOrganizeCarnets={onOrganizeCarnets}
          onOpenDetail={onOpenDetail}
          ariaLabel="Pour vous — sélection personnalisée"
        />
      </div>
    </section>
  );
}
