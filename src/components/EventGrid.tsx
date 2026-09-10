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
    <section
      id="explorer"
      className="scroll-mt-20 bg-foam px-5 py-10 md:px-8 md:py-14 lg:px-12 2xl:px-14 min-[1920px]:px-16"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)]">
        <header className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div className="min-w-0">
            <h2 className="font-display text-[1.75rem] leading-[1.02] tracking-tight text-ink md:text-[2.5rem] lg:text-[2.75rem] 2xl:text-[3rem]">
              {title}
            </h2>
            {resultTitle ? (
              <p className="mt-2.5 max-w-lg text-sm leading-6 text-cream-dim md:mt-3">
                {resultTitle}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 pb-0.5 text-right text-[12px] uppercase tracking-[0.12em] text-sand">
            {countLabel}
          </p>
        </header>

        {toolbar ? <div className="mb-7 md:mb-9">{toolbar}</div> : null}

        {events.length === 0 ? (
          <p className="max-w-lg font-editorial text-2xl leading-snug text-ink">
            Rien pour ces filtres pour le moment. Essayez une autre période ou
            catégorie.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 2xl:gap-x-6">
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  priority={index < 3}
                  isFavorite={favorites.has(event.id)}
                  onToggleFavorite={onToggleFavorite}
                  surface="explorer"
                />
              ))}
            </div>

            {onShowMore ? (
              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  onClick={onShowMore}
                  className="min-h-11 bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
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
