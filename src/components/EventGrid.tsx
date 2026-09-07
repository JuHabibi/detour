import type { ReactNode } from "react";
import { EventCard } from "@/components/EventCard";
import type { EventItem } from "@/data/types";

type EventGridProps = {
  /** Titre de section (exploration secondaire). */
  title?: string;
  /** Sous-titre dynamique selon le filtre temporel. */
  resultTitle?: string;
  toolbar?: ReactNode;
  events: EventItem[];
  /** Total filtré (avant « Voir plus ») — pour le compteur discret. */
  totalCount?: number;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onShowMore?: () => void;
};

export function EventGrid({
  title = "Explorer les sorties",
  resultTitle,
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
        <header className="mb-6 flex items-start justify-between gap-4 md:mb-8">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-sand">
              Explorer
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight md:text-5xl">
              {title}
            </h2>
            {resultTitle ? (
              <p className="mt-2 text-sm leading-6 text-cream-dim md:text-[0.95rem]">
                {resultTitle}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 pt-1 text-right text-xs text-sand md:pt-2 md:text-sm">
            {countLabel}
          </p>
        </header>

        {toolbar ? <div className="mb-6 md:mb-8">{toolbar}</div> : null}

        {events.length === 0 ? (
          <p className="max-w-lg font-display text-2xl leading-snug text-cream-dim">
            Rien pour ces filtres pour le moment. Essayez une autre période ou
            catégorie.
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
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={onShowMore}
                  className="min-h-11 border-b border-ink/25 px-2 pb-0.5 text-sm text-ink transition-colors hover:border-ink"
                >
                  Voir plus
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
