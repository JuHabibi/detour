"use client";

import { useMemo } from "react";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";
import { cn } from "@/lib/cn";
import { RadarEventCard } from "@/features/home/components/cards/RadarEventCard";
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

const COMPACT_POSTER_WIDTH =
  "w-[58%] sm:w-[32%] md:w-[24%] lg:w-[19%] 2xl:w-[17%]";

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
              Une piste compacte selon vos préférences — en complément du Radar,
              sans le remplacer.
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

        <div
          className={cn(
            "flex items-stretch gap-3 overflow-x-auto md:gap-3.5",
            "snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          )}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Pour vous — sélection personnalisée"
        >
          {events.map((event, index) => (
            <div
              key={event.id}
              className={cn(
                "flex h-full shrink-0 snap-start flex-col",
                COMPACT_POSTER_WIDTH,
              )}
            >
              <RadarEventCard
                event={event}
                priority={false}
                isFavorite={favorites.has(event.id)}
                onToggleFavorite={onToggleFavorite}
                carnetCount={carnetCounts?.get(event.id) ?? 0}
                onOrganizeCarnets={onOrganizeCarnets}
                rank={index + 1}
                onOpenDetail={onOpenDetail}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
