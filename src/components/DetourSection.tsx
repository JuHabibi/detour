import { StandardEventCard } from "@/components/EventCard";
import type { EventItem } from "@/data/types";

type DetourSectionProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
};

export function DetourSection({
  events,
  favorites,
  onToggleFavorite,
}: DetourSectionProps) {
  const picks = events.slice(0, 4);
  if (picks.length === 0) return null;

  return (
    <section id="detour" className="scroll-mt-24 bg-mint/20">
      <div className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-9 lg:px-12">
        <div className="mb-5 md:mb-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-sand">
            Découverte
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight md:text-[2.75rem]">
            Faites un détour
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-6 text-cream-dim">
            Des événements qu’on aurait facilement pu rater.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-7">
          {picks.map((event, index) => (
            <StandardEventCard
              key={event.id}
              event={event}
              priority={index < 2}
              isFavorite={favorites.has(event.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
