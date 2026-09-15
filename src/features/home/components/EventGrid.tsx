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
      className="scroll-mt-20 border-t border-line bg-foam px-5 py-10 md:px-8 md:py-14 lg:px-12 2xl:px-14 min-[1920px]:px-16"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)]">
        <header className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
              Parcourir
            </p>
            <h2 className="font-display text-[1.75rem] leading-[1.02] tracking-tight text-ink md:text-[2.25rem] lg:text-[2.5rem]">
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

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
          <div className="min-w-0">
            {events.length === 0 ? (
              <p className="max-w-lg font-editorial text-2xl leading-snug text-ink">
                Rien pour ces filtres pour le moment. Essayez une autre période
                ou catégorie.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 md:gap-y-7 lg:grid-cols-3 lg:gap-x-4 lg:gap-y-8">
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

          <ExplorerEditorialPanel />
        </div>
      </div>
    </section>
  );
}

/** Panneau statique desktop — différencie Explorer du Radar, sans données. */
function ExplorerEditorialPanel() {
  return (
    <aside className="hidden lg:block" aria-label="À propos d’Explorer">
      <div className="sticky top-24 flex min-h-[32rem] flex-col overflow-hidden bg-ink px-6 py-10 text-foam">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[url(/textures/radar-grain.jpg)] bg-cover bg-center opacity-[0.18]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -top-4 size-24 bg-mint/30"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -left-4 size-20 rotate-12 bg-coral/25"
        />

        <div className="relative flex flex-1 flex-col">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-foam/55">
            Explorer
          </p>
          <p className="mt-5 font-editorial text-[1.75rem] leading-snug">
            Filtrez. Scannez. Gardez ce qui compte.
          </p>
          <p className="mt-5 text-sm leading-6 text-foam/70">
            Ici, tout le catalogue autour d’Orléans. Le Radar, lui, choisit à
            votre place.
          </p>
          <p className="mt-auto pt-10 text-[11px] uppercase tracking-[0.14em] text-foam/40">
            Catalogue · Orléans
          </p>
        </div>
      </div>
    </aside>
  );
}
