import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicWeekendPage } from "@/application/weekend/get-public-weekend-page";
import { EVENT_META_ICON_STROKE } from "@/components/event/event-lucide-icons";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CITY } from "@/config/city";
import { WeekendEventCard } from "@/features/weekend/components/WeekendEventCard";

const SHELL =
  "mx-auto max-w-[var(--detour-shell-max)] px-5 md:px-10 lg:px-16 2xl:px-20 min-[1920px]:px-24";

type WeekendPageProps = {
  page: PublicWeekendPage;
};

/** Page serveur indexable — liens HTML vers les fiches publiques. */
export function WeekendPage({ page }: WeekendPageProps) {
  const hasEvents = page.events.length > 0;
  const countLabel =
    page.events.length === 0
      ? "0 proposition"
      : `${page.events.length} proposition${page.events.length > 1 ? "s" : ""}`;

  return (
    <div id="top" className="min-h-screen bg-paper">
      <Header homeHref="/" favoriteCount={0} />
      <main>
        <section className="overflow-hidden bg-paper">
          <div className={`${SHELL} py-7 md:py-11 lg:py-12`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-sand">
              Ce week-end · {CITY}
            </p>
            <p className="mt-3 text-sm leading-6 text-cream-dim md:text-[0.95rem]">
              {page.weekendLabel}
            </p>
            <h1 className="mt-4 max-w-[16ch] font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink sm:text-[2.55rem] md:mt-5 md:max-w-[18ch] md:text-[3rem] lg:text-[3.5rem]">
              Que faire à Orléans ce week-end&nbsp;?
            </h1>
            <p className="mt-5 max-w-md text-[0.95rem] leading-6 text-cream-dim md:mt-6 md:text-[1rem] md:leading-7">
              {hasEvents
                ? "Quelques sorties culturelles repérées dans l’agenda local, dates et horaires du week-end, sans tout lister."
                : "Aucune sortie culturelle pertinente n’est disponible pour ce week-end pour le moment."}
            </p>
          </div>
        </section>

        <section
          className="detour-decor detour-decor--explorer relative overflow-x-clip bg-foam"
          aria-labelledby="weekend-selection-heading"
        >
          <div className={`relative z-[1] ${SHELL} pt-8 pb-2 md:pt-10`}>
            <header className="mb-5 flex items-end justify-between gap-4 md:mb-6">
              <div className="min-w-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sand md:mb-2.5">
                  Parcourir
                </p>
                <h2
                  id="weekend-selection-heading"
                  className="font-display text-[1.75rem] leading-[1.02] tracking-tight text-ink md:text-[2.25rem] lg:text-[2.5rem]"
                >
                  {hasEvents
                    ? "Sorties de ce week-end"
                    : "Rien à afficher pour l’instant"}
                </h2>
                {hasEvents ? (
                  <p className="mt-3 max-w-lg text-sm leading-6 text-cream-dim md:mt-3.5">
                    Une sélection courte autour d’{CITY} — pour aller plus loin,
                    ouvrez Explorer.
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 pb-0.5 text-right text-[12px] uppercase tracking-[0.12em] text-sand">
                {countLabel}
              </p>
            </header>

            {hasEvents ? (
              <ul className="grid list-none grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 md:gap-y-7 lg:grid-cols-4 lg:gap-y-8">
                {page.events.map((event, index) => (
                  <li key={event.id}>
                    <WeekendEventCard
                      event={event}
                      priority={index < 3}
                      saturdayKey={page.saturdayKey}
                      sundayKey={page.sundayKey}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="max-w-lg font-editorial text-2xl leading-snug text-ink">
                Aucune sortie culturelle exploitable pour ce week-end. Essayez
                Explorer pour élargir la période ou les filtres.
              </p>
            )}

            <div className="mt-10 max-w-lg md:mt-12">
              {hasEvents && page.culturalActiveCount > page.events.length ? (
                <p className="text-sm leading-6 text-ink/70 md:text-[0.95rem]">
                  D’autres sorties existent sur ce week-end.
                </p>
              ) : hasEvents ? (
                <p className="text-sm leading-6 text-ink/70 md:text-[0.95rem]">
                  Envie d’élargir la recherche&nbsp;?
                </p>
              ) : null}
              <Link
                href={page.explorerHref}
                className="mt-3.5 inline-flex min-h-11 items-center gap-2.5 border border-ink/25 bg-paper px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Explorer les sorties (Ce week-end)
                <ArrowRight
                  aria-hidden
                  className="size-3.5 shrink-0"
                  strokeWidth={EVENT_META_ICON_STROKE}
                />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
