import type { ReactNode } from "react";
import { ExplorerEventCard } from "@/features/explorer/components/ExplorerEventCard";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";

type EventGridProps = {
  /** Titre principal de la page Explorer. */
  title?: string;
  /** Sous-titre dynamique selon le filtre temporel. */
  resultTitle?: string;
  /** Message empty state — oriente vers d’autres filtres. */
  emptyMessage?: string;
  toolbar?: ReactNode;
  events: EventItem[];
  /** Total filtré (avant « Voir plus ») — pour le compteur discret. */
  totalCount?: number;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  carnetCounts?: Map<string, number>;
  onOrganizeCarnets?: (event: EventItem) => void;
  onOpenDetail?: OpenEventDetailHandler;
  onShowMore?: () => void;
};

const DEFAULT_EMPTY_MESSAGE =
  "Aucune sortie pour ces filtres. Essayez une autre période, ville ou catégorie.";

const SHELL =
  "mx-auto max-w-[var(--detour-shell-max)] px-5 md:px-10 lg:px-16 2xl:px-20 min-[1920px]:px-24";

export function EventGrid({
  title = "Explorer les sorties",
  resultTitle,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  toolbar,
  events,
  totalCount,
  favorites,
  onToggleFavorite,
  carnetCounts,
  onOrganizeCarnets,
  onOpenDetail,
  onShowMore,
}: EventGridProps) {
  const total = totalCount ?? events.length;
  const countLabel =
    total === 0
      ? "0 proposition"
      : total > events.length
        ? `${events.length} sur ${total}`
        : `${events.length} proposition${events.length > 1 ? "s" : ""}`;

  return (
    <div id="explorer" className="scroll-mt-20">
      {/* Zone outil — fond uni, sans texture */}
      {toolbar ? (
        <section
          aria-label="Filtres d’exploration"
          className="sticky top-[var(--detour-header-height,3.25rem)] z-30 border-b border-line bg-paper/95 backdrop-blur-sm"
        >
          <div className={`${SHELL} py-5 md:py-6`}>
            <div className="mx-auto w-full max-w-[760px]">{toolbar}</div>
          </div>
        </section>
      ) : null}

      {/* Zone résultats — fond texturé paper */}
      <section className="detour-decor detour-decor--explorer relative overflow-x-clip bg-foam">
        <div className={`relative z-[1] ${SHELL} pt-8 pb-2 md:pt-10`}>
          <header className="mb-5 flex items-end justify-between gap-4 md:mb-6">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sand md:mb-2.5">
                Parcourir
              </p>
              <h1 className="font-display text-[1.75rem] leading-[1.02] tracking-tight text-ink md:text-[2.25rem] lg:text-[2.5rem]">
                {title}
              </h1>
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

          {events.length === 0 ? (
            <p className="max-w-lg font-editorial text-2xl leading-snug text-ink">
              {emptyMessage}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 md:gap-y-7 lg:grid-cols-4 lg:gap-y-8">
                {events.map((event, index) => (
                  <ExplorerEventCard
                    key={event.id}
                    event={event}
                    priority={index < 3}
                    isFavorite={favorites.has(event.id)}
                    onToggleFavorite={onToggleFavorite}
                    carnetCount={carnetCounts?.get(event.id) ?? 0}
                    onOrganizeCarnets={onOrganizeCarnets}
                    onOpenDetail={onOpenDetail}
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
    </div>
  );
}
