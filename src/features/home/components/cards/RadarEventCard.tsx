"use client";

import Image from "next/image";
import { formatWhen } from "@/components/event/format-when";
import type { EventItem } from "@/data/types";
import {
  canOpenEventDetail,
  CardFavoriteActions,
  EventOpenControl,
  type HomeEventCardProps,
} from "@/components/event/EventCardInteractions";
import {
  AvailabilityBadgePill,
  CategoryBadge,
  EditorialBadgePill,
  EventPlaceDateLines,
  formatPrice,
  LocationLine,
  resolveEventImageAlt,
  resolveNoImageCardTone,
  resolveSignal,
} from "@/components/event/EventCardPresentation";
import { resolveRadarPickReason } from "@/features/home/resolve-radar-pick-reason";
import { cn } from "@/lib/cn";

type RadarEventCardProps = HomeEventCardProps & {
  rank?: number;
};

export function RadarEventCard(props: RadarEventCardProps) {
  if (!props.event.image) {
    return <RadarTextEventCard {...props} />;
  }
  return <RadarImageEventCard {...props} />;
}

function RadarImageEventCard({
  event,
  isFavorite = false,
  onToggleFavorite,
  carnetCount = 0,
  onOrganizeCarnets,
  priority = false,
  rank,
  onOpenDetail,
}: RadarEventCardProps) {
  const imageSrc: string = event.image!;
  const whenLabel = formatWhen(event);
  const rankLabel =
    typeof rank === "number" ? String(rank).padStart(2, "0") : null;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col text-ink",
        canOpenEventDetail(event, onOpenDetail) && "cursor-pointer",
      )}
    >
      <EventOpenControl
        event={event}
        surface="radar"
        onOpenDetail={onOpenDetail}
      />
      <div className="relative aspect-[4/5] overflow-hidden bg-ink/10">
        <Image
          src={imageSrc}
          alt={resolveEventImageAlt(event)}
          fill
          priority={priority}
          sizes="(max-width: 640px) 64vw, (max-width: 1024px) 28vw, 22vw"
          className="object-cover object-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        <CardFavoriteActions
          event={event}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          carnetCount={carnetCount}
          onOrganizeCarnets={onOrganizeCarnets}
          className="absolute right-2 top-2 z-[2] border-0"
        />
      </div>

      <div className="relative flex shrink-0 flex-col bg-foam px-3 pb-3 pt-2.5 md:px-3.5 md:pb-3.5 md:pt-3">
        <div className="flex h-7 shrink-0 items-center gap-x-2 overflow-hidden">
          {rankLabel ? (
            <span className="shrink-0 font-editorial text-[1.25rem] leading-none tracking-tight text-coral md:text-[1.4rem]">
              {rankLabel}
            </span>
          ) : null}
          <EditorialBadgePill label={event.editorialBadge} tone="radar" />
          {event.availabilityBadge ? (
            <span
              className={cn(
                "inline-flex min-w-0 shrink items-center truncate border border-coral/25 bg-paper px-2 py-1",
                "text-[11px] font-semibold uppercase tracking-[0.08em] text-coral",
              )}
            >
              {event.availabilityBadge}
            </span>
          ) : null}
        </div>

        <div className="mt-1.5 flex h-6 shrink-0 items-center">
          <CategoryBadge
            event={event}
            className="px-2 py-1 tracking-[0.1em]"
          />
        </div>

        <h3
          className={cn(
            "mt-2 line-clamp-2 font-display font-semibold tracking-tight text-ink",
            "min-h-[calc(1.25rem*1.08*2)] text-[1.25rem] leading-[1.08]",
            "md:min-h-[calc(1.35rem*1.08*2)] md:text-[1.35rem]",
          )}
        >
          {event.title}
        </h3>

        <div className="mt-2 flex h-[2.75rem] shrink-0 flex-col justify-end">
          <EventPlaceDateLines
            venue={event.venue}
            whenLabel={whenLabel}
            reservePlaceLine
          />
        </div>

        <RadarCardCta event={event} />
      </div>
    </article>
  );
}

function RadarTextEventCard({
  event,
  isFavorite = false,
  onToggleFavorite,
  carnetCount = 0,
  onOrganizeCarnets,
  onOpenDetail,
}: RadarEventCardProps) {
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);
  const { pastel, accent } = resolveNoImageCardTone(event);

  return (
    <article
      className={cn(
        "group relative flex h-full min-h-[14.5rem] flex-col overflow-hidden md:min-h-[16.5rem] lg:min-h-0",
        pastel,
        canOpenEventDetail(event, onOpenDetail) && "cursor-pointer",
      )}
    >
      <EventOpenControl
        event={event}
        surface="radar"
        onOpenDetail={onOpenDetail}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-6 -top-8 size-24 opacity-70",
          accent,
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-10 -left-4 size-20 rotate-12 opacity-50",
          accent,
        )}
      />

      <div className="relative flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CategoryBadge event={event} className="tracking-[0.16em]" />
            <EditorialBadgePill label={event.editorialBadge} />
            <AvailabilityBadgePill label={event.availabilityBadge} />
          </div>
          <CardFavoriteActions
            event={event}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            carnetCount={carnetCount}
            onOrganizeCarnets={onOrganizeCarnets}
            className="relative z-[2] shrink-0 bg-paper/70"
          />
        </div>

        {signal ? (
          <p className="mt-2.5 text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
            {signal}
          </p>
        ) : null}

        <h3 className="mt-2.5 font-display text-[1.85rem] leading-[1.05] tracking-tight md:text-[2.2rem]">
          {event.title}
        </h3>

        {event.description ? (
          <p className="mt-2.5 line-clamp-2 text-sm leading-6 text-cream-dim">
            {event.description}
          </p>
        ) : null}

        <div className="mt-auto space-y-1.5 pt-5 text-sm">
          <EventPlaceDateLines venue={event.venue} whenLabel={whenLabel} />
          <LocationLine
            city={event.city}
            distanceKm={event.distanceKm}
            cityClassName="text-cream-dim"
            sepClassName="text-sand"
            distanceClassName="font-medium text-ink"
          />
          {priceLabel ? (
            <p className="font-medium text-ink">{priceLabel}</p>
          ) : null}
          <RadarCardCta event={event} />
        </div>
      </div>
    </article>
  );
}

export function resolveRadarCardCtaLabel(event: EventItem): string {
  return resolveRadarPickReason(event)
    ? "Pourquoi le repérer ?"
    : "Découvrir l’événement";
}

function RadarCardCta({ event }: { event: EventItem }) {
  const hasPickReason = Boolean(resolveRadarPickReason(event));
  const label = resolveRadarCardCtaLabel(event);

  return (
    <div
      aria-hidden
      data-testid="radar-card-cta"
      data-cta={hasPickReason ? "why-pick" : "discover"}
      className="mt-3 flex h-7 shrink-0 items-center"
    >
      <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-sand underline decoration-coral/70 decoration-1 underline-offset-4">
        {label}
      </span>
    </div>
  );
}
