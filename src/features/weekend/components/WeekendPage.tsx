import Image from "next/image";
import Link from "next/link";
import type { PublicWeekendPage } from "@/application/weekend/get-public-weekend-page";
import { resolveCategoryBadgeTone } from "@/components/event/category-badge-style";
import { formatWhen } from "@/components/event/format-when";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import type { EventItem } from "@/data/types";
import { eventPublicPath } from "@/lib/event-public-path";
import { cn } from "@/lib/cn";

type WeekendPageProps = {
  page: PublicWeekendPage;
};

/** Page serveur indexable — liens HTML vers les fiches publiques. */
export function WeekendPage({ page }: WeekendPageProps) {
  const hasEvents = page.events.length > 0;

  return (
    <div id="top" className="min-h-screen bg-paper">
      <Header homeHref="/" favoriteCount={0} />
      <main>
        <section className="border-b border-line px-5 py-10 md:px-8 md:py-14 lg:px-12 2xl:px-14 min-[1920px]:px-16">
          <div className="mx-auto max-w-[var(--detour-shell-max)]">
            <p className="font-editorial text-lg text-sand md:text-xl">
              {page.weekendLabel}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
              Que faire à Orléans ce week-end&nbsp;?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-sand md:text-lg md:leading-8">
              {hasEvents
                ? "Quelques sorties culturelles repérées dans l’agenda local — dates et horaires du week-end, sans tout lister."
                : "Aucune sortie culturelle pertinente n’est disponible pour ce week-end pour le moment."}
            </p>
            <p className="mt-6">
              <Link
                href={page.explorerHref}
                className="inline-flex items-center text-sm font-medium text-ink underline decoration-coral decoration-2 underline-offset-4 transition-colors hover:text-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Voir tout dans Explorer (filtre Ce week-end)
              </Link>
            </p>
          </div>
        </section>

        <section
          className="px-5 py-10 md:px-8 md:py-12 lg:px-12 2xl:px-14 min-[1920px]:px-16"
          aria-labelledby="weekend-selection-heading"
        >
          <div className="mx-auto max-w-[var(--detour-shell-max)]">
            <h2
              id="weekend-selection-heading"
              className="font-editorial text-2xl text-ink md:text-3xl"
            >
              {hasEvents ? "À découvrir" : "Rien à afficher pour l’instant"}
            </h2>

            {hasEvents ? (
              <ul className="mt-8 grid list-none gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {page.events.map((event, index) => (
                  <li key={event.id}>
                    <WeekendEventCard event={event} priority={index < 2} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-8 max-w-xl border border-line bg-foam px-5 py-6">
                <p className="text-sm leading-6 text-sand">
                  Le corpus du week-end ne contient pas assez de sorties
                  culturelles exploitables. Revenez plus tard, ou parcourez
                  Explorer pour élargir la période et les filtres.
                </p>
                <p className="mt-4">
                  <Link
                    href={page.explorerHref}
                    className="text-sm font-medium text-ink underline decoration-coral decoration-2 underline-offset-4"
                  >
                    Ouvrir Explorer
                  </Link>
                </p>
              </div>
            )}

            {hasEvents && page.culturalActiveCount > page.events.length ? (
              <p className="mt-10 max-w-2xl text-sm leading-6 text-sand">
                D’autres sorties existent sur ce week-end.{" "}
                <Link
                  href={page.explorerHref}
                  className="font-medium text-ink underline decoration-coral decoration-2 underline-offset-4"
                >
                  Les parcourir dans Explorer
                </Link>
                .
              </p>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function WeekendEventCard({
  event,
  priority,
}: {
  event: EventItem;
  priority: boolean;
}) {
  const href = eventPublicPath(event.id);
  const whenLabel = formatWhen(event);
  const place = [event.venue, event.city].filter(Boolean).join(" · ");
  const categoryLabel =
    event.category && event.category !== "tout" ? event.category : null;
  const imageAlt = event.imageAlt?.trim() || "";

  if (!event.image) {
    return (
      <article className="h-full">
        <Link
          href={href}
          className="group flex h-full min-h-[14rem] flex-col border border-line bg-foam p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {categoryLabel ? (
            <span
              className={cn(
                "inline-block max-w-full truncate px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
                resolveCategoryBadgeTone(event.category),
              )}
            >
              {categoryLabel}
            </span>
          ) : null}
          <h3 className="mt-3 font-display text-xl leading-snug tracking-tight group-hover:text-coral">
            {event.title}
          </h3>
          <div className="mt-auto space-y-1 pt-5 text-sm text-sand">
            <p>{whenLabel}</p>
            {place ? <p>{place}</p> : null}
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="h-full">
      <Link
        href={href}
        className="group flex h-full flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-ink-3">
          <Image
            src={event.image}
            alt={imageAlt}
            fill
            priority={priority}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
            className="object-cover object-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-1 flex-col pt-2.5">
          {categoryLabel ? (
            <span
              className={cn(
                "inline-block max-w-full truncate px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
                resolveCategoryBadgeTone(event.category),
              )}
            >
              {categoryLabel}
            </span>
          ) : null}
          <h3 className="mt-1 font-display text-xl leading-snug tracking-tight group-hover:text-coral">
            {event.title}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-sand">
            <p>{whenLabel}</p>
            {place ? <p>{place}</p> : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
