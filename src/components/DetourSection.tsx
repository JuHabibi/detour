import { FeaturedEventCard, StandardEventCard } from "@/components/EventCard";
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
  const [featured, ...rest] = events;
  if (!featured) return null;

  const secondary = rest.slice(0, 3);

  return (
    <section id="detour" className="scroll-mt-24 bg-mint/20">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-8 md:py-11 lg:px-12">
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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-4">
          <div className="lg:col-span-7">
            <FeaturedEventCard
              event={featured}
              priority
              isFavorite={favorites.has(featured.id)}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:gap-4">
            {secondary.map((event, index) => (
              <StandardEventCard
                key={event.id}
                event={event}
                priority={index === 0}
                isFavorite={favorites.has(event.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
