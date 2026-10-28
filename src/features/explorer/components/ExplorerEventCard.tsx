"use client";

import Image from "next/image";
import { formatWhen } from "@/components/event/format-when";
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
import { cn } from "@/lib/cn";

export function ExplorerEventCard(props: HomeEventCardProps) {
  if (!props.event.image) {
    return <ExplorerTextEventCard {...props} />;
  }
  return <ExplorerImageEventCard {...props} />;
}

function ExplorerImageEventCard({
  event,
  isFavorite = false,
  onToggleFavorite,
  carnetCount = 0,
  onOrganizeCarnets,
  priority = false,
  onOpenDetail,
}: HomeEventCardProps) {
  const imageSrc: string = event.image!;
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);

  return (
    <article
      className={cn(
        "group relative flex h-full gap-3 md:flex-col md:gap-0",
        canOpenEventDetail(event, onOpenDetail) && "cursor-pointer",
      )}
    >
      <EventOpenControl
        event={event}
        surface="explorer"
        onOpenDetail={onOpenDetail}
      />
      <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden bg-ink-3 md:aspect-[16/10] md:w-auto">
        <Image
          src={imageSrc}
          alt={resolveEventImageAlt(event)}
          fill
          priority={priority}
          sizes="(max-width: 767px) 7rem, (max-width: 1024px) 50vw, 18vw"
          className="object-cover object-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        <CardFavoriteActions
          event={event}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          carnetCount={carnetCount}
          onOrganizeCarnets={onOrganizeCarnets}
          className="absolute right-2 top-2 z-[2] hidden border-0 md:flex"
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col py-0.5 md:pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CategoryBadge event={event} className="px-2 py-1" />
            <div className="hidden md:block">
              <EditorialBadgePill label={event.editorialBadge} />
              <AvailabilityBadgePill label={event.availabilityBadge} />
            </div>
          </div>
          <CardFavoriteActions
            event={event}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            carnetCount={carnetCount}
            onOrganizeCarnets={onOrganizeCarnets}
            className="relative z-[2] shrink-0 md:hidden"
          />
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-[1.15rem] font-semibold leading-[1.08] tracking-tight text-ink md:mt-1 md:text-[1.2rem]">
          {event.title}
        </h3>
        <div className="mt-auto space-y-1.5 pt-1.5 text-sm md:pt-2">
          <EventPlaceDateLines venue={event.venue} whenLabel={whenLabel} />
          <div className={cn("text-sm", event.venue && "hidden md:block")}>
            <LocationLine
              city={event.city}
              distanceKm={event.distanceKm}
              cityClassName="text-cream-dim"
              sepClassName="text-sand"
              distanceClassName="font-medium text-ink"
            />
          </div>
          {priceLabel ? (
            <p className="hidden font-medium text-ink md:block">{priceLabel}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ExplorerTextEventCard({
  event,
  isFavorite = false,
  onToggleFavorite,
  carnetCount = 0,
  onOrganizeCarnets,
  onOpenDetail,
}: HomeEventCardProps) {
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);
  const { pastel, accent } = resolveNoImageCardTone(event);

  return (
    <article
      className={cn(
        "group relative flex h-full min-h-[15.5rem] flex-col overflow-hidden",
        pastel,
        canOpenEventDetail(event, onOpenDetail) && "cursor-pointer",
      )}
    >
      <EventOpenControl
        event={event}
        surface="explorer"
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
            <CategoryBadge event={event} className="px-2 py-1" />
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

        <h3 className="mt-2.5 line-clamp-3 font-display text-[1.4rem] font-semibold leading-[1.08] tracking-tight md:text-[1.5rem]">
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
        </div>
      </div>
    </article>
  );
}
