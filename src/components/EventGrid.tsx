import type { ReactNode } from "react";
import { EventCard } from "@/components/EventCard";
import type { EventItem } from "@/data/types";

type EventGridProps = {
  title?: string;
  toolbar?: ReactNode;
  events: EventItem[];
  /** Total filtré (avant « Voir plus ») — pour le compteur discret. */
  totalCount?: number;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onShowMore?: () => void;
};

export function EventGrid({
  title = "Ce week-end autour d’Orléans",
  toolbar,
  events,
  totalCount,
  favorites,
  onToggleFavorite,
  onShowMore,
}: EventGridProps) {
  const total = totalCount ?? events.length;
  const countLabel =
    total > events.length
      ? `${events.length} sur ${total}`
      : `${events.length} proposition${events.length > 1 ? "s" : ""}`;

  return (
    <section id="explorer" className="scroll-mt-24 px-5 py-10 md:px-8 md:py-14 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-sand">
              Autour d’Orléans
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight md:text-5xl">
              {title}
            </h2>
          </div>
          <p className="hidden text-sm text-sand md:block">{countLabel}</p>
        </div>

        {toolbar ? <div className="mb-7 flex flex-col gap-4">{toolbar}</div> : null}

        {events.length === 0 ? (
          <p className="max-w-lg font-display text-2xl leading-snug text-cream-dim">
            Rien dans ce rayon pour le moment. Essayez un peu plus loin.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

            {onShowMore ? (
              <div className="mt-10 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={onShowMore}
                  className="min-h-11 border-b border-ink/25 px-2 pb-0.5 text-sm text-ink transition-colors hover:border-ink"
                >
                  Voir plus
                </button>
                <p className="text-xs text-sand md:hidden">
                  {events.length} sur {total}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
