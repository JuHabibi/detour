"use client";

import { formatDistanceKm } from "@/application/format-distance";
import type { EventItem } from "@/data/types";
import { cn } from "@/lib/cn";

type UpcomingSectionProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
};

const MONTHS_SHORT_FR = [
  "JAN",
  "FÉV",
  "MAR",
  "AVR",
  "MAI",
  "JUIN",
  "JUIL",
  "AOÛT",
  "SEPT",
  "OCT",
  "NOV",
  "DÉC",
];

export function UpcomingSection({
  events,
  favorites,
  onToggleFavorite,
}: UpcomingSectionProps) {
  if (events.length === 0) return null;

  return (
    <section id="a-prevoir" className="scroll-mt-24 px-5 py-10 md:px-8 md:py-14 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-8 md:mb-10">
          <p className="text-[11px] uppercase tracking-[0.28em] text-sand">
            Plus tard
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight md:text-5xl">
            À prévoir
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-cream-dim">
          Des événements à repérer dès maintenant pour pouvoir s’organiser.
          </p>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {events.map((event) => (
            <UpcomingRow
              key={event.id}
              event={event}
              isFavorite={favorites.has(event.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function UpcomingRow({
  event,
  isFavorite,
  onToggleFavorite,
}: {
  event: EventItem;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const { day, month, year, showYear } = formatUpcomingDate(event.date);
  const action = resolveUpcomingAction(event);
  const priceLabel =
    event.price == null
      ? null
      : event.price === "free"
        ? "Gratuit"
        : `${event.price} €`;

  return (
    <article
      className={cn(
        "group relative grid grid-cols-[4.5rem_1fr_auto] items-start gap-4 py-6 md:grid-cols-[6.5rem_1fr_auto] md:gap-8 md:py-7",
        action.href && "cursor-pointer",
      )}
    >
      {action.href ? (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-[1]"
          aria-label={`${action.label} — « ${event.title} » (nouvel onglet)`}
        />
      ) : null}
      <div className="relative pt-0.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-sand">
          {month}
        </p>
        <p className="mt-1 font-display text-4xl leading-none tracking-tight md:text-5xl">
          {day}
        </p>
        {showYear ? (
          <p className="mt-1.5 text-[11px] tracking-[0.08em] text-sand">
            {year}
          </p>
        ) : null}
      </div>

      <div className="relative min-w-0">
        {event.genre ? (
          <p className="text-[11px] uppercase tracking-[0.14em] text-sand">
            {event.genre}
          </p>
        ) : null}
        <h3 className="mt-1.5 font-display text-[1.45rem] leading-tight md:text-[1.7rem]">
          {event.title}
        </h3>
        {event.description ? (
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream-dim line-clamp-2">
            {event.description}
          </p>
        ) : null}
        <p className="mt-3 text-sm">
          {event.city ? (
            <span className="text-cream-dim">{event.city}</span>
          ) : null}
          {event.city && event.distanceKm != null ? (
            <span className="text-sand"> · </span>
          ) : null}
          {event.distanceKm != null ? (
            <span className="font-medium text-ink">
              {formatDistanceKm(event.distanceKm)}
            </span>
          ) : null}
          {event.time ? (
            <>
              {(event.city || event.distanceKm != null) && (
                <span className="text-sand"> · </span>
              )}
              <span className="text-cream-dim">{event.time}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="relative z-[2] flex flex-col items-end gap-3 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(event.id);
          }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className="flex size-9 items-center justify-center rounded-full border border-line bg-foam text-ink transition-colors hover:border-ink/20"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 20s-7.2-4.4-9.2-8.6C1.2 8.2 3 5 6.4 5c2 0 3.3 1.1 3.6 1.5C10.3 6.1 11.6 5 13.6 5 17 5 18.8 8.2 17.2 11.4 15.2 15.6 12 20 12 20Z"
              className={cn(
                isFavorite ? "fill-coral stroke-coral" : "stroke-current",
              )}
              strokeWidth="1.6"
            />
          </svg>
        </button>
        {priceLabel ? <p className="text-sm text-ink">{priceLabel}</p> : null}
      </div>
    </article>
  );
}

function formatUpcomingDate(dateKey: string) {
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = dayStr ?? "01";

  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
    }).format(new Date()),
  );

  return {
    day,
    month: MONTHS_SHORT_FR[monthIndex] ?? "",
    year,
    showYear: year !== currentYear,
  };
}

function resolveUpcomingAction(event: EventItem): {
  href?: string;
  label: string;
} {
  if (event.registrationUrl) {
    return { href: event.registrationUrl, label: "Réserver" };
  }
  if (event.sourceUrl) {
    return { href: event.sourceUrl, label: "Voir les infos" };
  }
  return { label: "Voir les infos" };
}
