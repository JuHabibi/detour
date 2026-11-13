import Image from "next/image";
import type { ReactNode } from "react";
import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import { resolveCategoryBadgeTone } from "@/components/event/category-badge-style";
import {
  EventCalendarClockIcon,
  EventMapPinIcon,
  EventMoveUpRightIcon,
} from "@/components/event/event-lucide-icons";
import { formatPrice } from "@/components/event/EventCardPresentation";
import {
  resolveOfficialSourceLink,
  type OfficialSourceLink,
} from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";
import { plainEventText } from "@/features/event-page/event-page-seo";
import { cn } from "@/lib/cn";
import { EventSchedule } from "@/components/event/EventSchedule";

type EventPublicViewProps = {
  item: EventItem;
  isEnded: boolean;
  favoriteActions?: ReactNode;
};

export function EventPublicView({
  item,
  isEnded,
  favoriteActions,
}: EventPublicViewProps) {
  const description = plainEventText(item.description);
  const priceLabel = formatPrice(item.price);
  const venue = item.venue?.trim() || null;
  const city = item.city?.trim() || null;
  const conditions = item.conditions?.trim() || null;
  const availabilityLabel = item.availabilityBadge?.trim() || null;
  const source = item.source?.trim() || null;
  const official = isEnded ? null : resolveOfficialSourceLink(item);
  const endedOfficial = isEnded ? resolveEndedSourceLink(item) : null;
  const cta = official ?? endedOfficial;
  const hasPracticalInfo = Boolean(
    priceLabel || availabilityLabel || conditions,
  );

  return (
    <article className="mx-auto w-full max-w-2xl px-5 pb-16 pt-8 md:px-8">
      {isEnded ? (
        <p
          data-testid="event-ended-banner"
          className="mb-5 inline-flex border border-line bg-paper px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sand"
        >
          Événement terminé
        </p>
      ) : null}

      {item.image ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-ink/10">
          <Image
            src={item.image}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 42rem"
            className="object-cover object-center"
          />
          {favoriteActions ? (
            <div className="absolute right-2 top-2 z-[2]">{favoriteActions}</div>
          ) : null}
        </div>
      ) : favoriteActions ? (
        <div className="mb-4 flex justify-end">{favoriteActions}</div>
      ) : null}

      <div className="mt-5">
        <span
          className={cn(
            "inline-block max-w-full truncate px-2 py-1",
            "text-[11px] font-medium uppercase tracking-[0.1em]",
            resolveCategoryBadgeTone(item.category),
          )}
        >
          {resolveCategoryBadgeLabel(item)}
        </span>
      </div>

      <h1 className="mt-3 font-display text-[1.85rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[2.25rem]">
        {item.title}
      </h1>

      <div className="mt-4 space-y-2 text-sm text-cream-dim">
        <p className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2.5 italic text-sand">
          <EventCalendarClockIcon className="mt-0.5" />
          <span className="min-w-0 leading-5">
            {item.dateLabel}
            {item.time && !item.allDay ? ` · ${item.time}` : ""}
          </span>
        </p>
        {venue ? (
          <p className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2.5">
            <EventMapPinIcon className="mt-0.5" />
            <span className="min-w-0 leading-5 text-ink">{venue}</span>
          </p>
        ) : null}
        {city && venue ? (
          <p className="pl-[1.625rem] leading-5 text-cream-dim">{city}</p>
        ) : null}
        {city && !venue ? (
          <p className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2.5">
            <EventMapPinIcon className="mt-0.5" />
            <span className="min-w-0 leading-5">{city}</span>
          </p>
        ) : null}
      </div>

      <EventSchedule event={item} />

      {hasPracticalInfo ? (
        <div
          data-testid="event-practical"
          className="mt-5 space-y-1.5 border-t border-line/70 pt-4 text-sm"
        >
          {priceLabel ? (
            <p data-testid="event-price" className="font-medium text-ink">
              {priceLabel}
            </p>
          ) : null}
          {availabilityLabel && !isEnded ? (
            <p
              data-testid="event-availability"
              className="font-semibold uppercase tracking-[0.06em] text-coral"
            >
              {availabilityLabel}
            </p>
          ) : null}
          {conditions ? (
            <p
              data-testid="event-conditions"
              className="leading-6 text-cream-dim"
            >
              {conditions}
            </p>
          ) : null}
        </div>
      ) : null}

      {description ? (
        <div
          data-testid="event-about"
          className="mt-6 border-t border-line/70 pt-5"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
            À propos de l’événement
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-cream-dim">
            {description}
          </p>
        </div>
      ) : null}

      {source ? (
        <p
          data-testid="event-source"
          className="mt-6 text-xs tracking-[0.04em] text-sand"
        >
          Source : {source}
        </p>
      ) : null}

      {cta ? (
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="event-official-link"
          data-cta={cta.kind}
          className={cn(
            "mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2.5 px-4 text-center text-[12px] font-medium uppercase tracking-[0.1em] transition-colors",
            isEnded
              ? "border border-line bg-paper text-ink hover:bg-foam"
              : "bg-mint text-ink hover:bg-ink hover:text-foam",
          )}
        >
          <span className="min-w-0">{cta.label}</span>
          <EventMoveUpRightIcon className="text-current" />
        </a>
      ) : null}
    </article>
  );
}

/** Passé : lien info uniquement, jamais d’incitation à réserver. */
function resolveEndedSourceLink(
  event: Pick<EventItem, "sourceUrl" | "registrationUrl">,
): OfficialSourceLink | null {
  const sourceUrl = event.sourceUrl?.trim() || null;
  if (sourceUrl) {
    return {
      href: sourceUrl,
      label: "Voir la fiche officielle",
      kind: "official",
    };
  }
  return null;
}
