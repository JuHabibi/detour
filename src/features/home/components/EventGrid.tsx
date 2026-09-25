import type { ReactNode } from "react";
import { EventCard } from "@/features/home/components/EventCard";
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
      className="detour-decor detour-decor--explorer relative scroll-mt-20 overflow-x-clip border-t border-line bg-foam pt-10 md:pt-14"
    >
      <div className="relative z-[1] mx-auto max-w-[var(--detour-shell-max)] px-5 md:px-10 lg:px-16 2xl:px-20 min-[1920px]:px-24">
        {/* Groupe titre / sous-titre / filtres — respiration interne, gap contenu contenu */}
        <div className="mb-6 md:mb-7">
          <header className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sand md:mb-2.5">
                Parcourir
              </p>
              <h2 className="font-display text-[1.75rem] leading-[1.02] tracking-tight text-ink md:text-[2.25rem] lg:text-[2.5rem]">
                {title}
              </h2>
              {resultTitle ? (
                <p className="mt-3 max-w-lg text-sm leading-6 text-cream-dim md:mt-3.5">
                  {resultTitle}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 pb-0.5 text-right text-[12px] uppercase tracking-[0.12em] text-sand">
              {countLabel}
            </p>
          </header>

          {toolbar ? <div className="mt-5 md:mt-6">{toolbar}</div> : null}
        </div>

        {events.length === 0 ? (
          <p className="max-w-lg font-editorial text-2xl leading-snug text-ink">
            Rien pour ces filtres pour le moment. Essayez une autre période ou
            catégorie.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 md:gap-y-7 lg:grid-cols-4 lg:gap-y-8">
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
              <div className="mt-10 flex justify-center md:mt-12">
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

      {/* Vélo en bout de section — hors padding horizontal/bas pour coller au bord */}
      <div
        aria-hidden
        className="pointer-events-none relative z-[1] mt-6 flex justify-end md:mt-8 lg:mt-10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- décor PNG alpha hors LCP */}
        <img
          src="/images/editorial/explorer-bike-overlay.png"
          alt=""
          width={737}
          height={405}
          loading="lazy"
          decoding="async"
          className="detour-overlay detour-overlay--explorer-bike"
        />
      </div>
    </section>
  );
}
