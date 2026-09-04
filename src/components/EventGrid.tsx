import { EventCard } from "@/components/EventCard";
import type { EventItem } from "@/data/types";

type EventGridProps = {
  title?: string;
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
};

export function EventGrid({
  title = "Ce week-end autour de vous",
  events,
  favorites,
  onToggleFavorite,
}: EventGridProps) {
  return (
    <section id="week-end" className="scroll-mt-24 px-5 py-10 md:px-8 md:py-14 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-7 flex items-end justify-between gap-4 md:mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-sand">
              Autour de vous
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight md:text-5xl">
              {title}
            </h2>
          </div>
          <p className="hidden text-sm text-sand md:block">
            {events.length} proposition{events.length > 1 ? "s" : ""}
          </p>
        </div>

        {events.length === 0 ? (
          <p className="max-w-lg font-display text-2xl leading-snug text-cream-dim">
            Rien dans ce rayon pour le moment. Essayez un peu plus loin.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                priority={index < 3}
                isFavorite={favorites.has(event.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
