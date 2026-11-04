"use client";

import Image from "next/image";
import Link from "next/link";
import { formatWhen } from "@/components/event/format-when";
import {
  CategoryBadge,
  EventPlaceDateLines,
  formatPrice,
  LocationLine,
  resolveEventImageAlt,
  resolveNoImageCardTone,
  resolveSignal,
} from "@/components/event/EventCardPresentation";
import type { EventItem } from "@/data/types";
import { eventPublicPath } from "@/lib/event-public-path";
import { cn } from "@/lib/cn";

type WeekendEventCardProps = {
  event: EventItem;
  priority?: boolean;
};

/** Carte alignée Explorer — lien HTML vers la fiche publique (SEO). */
export function WeekendEventCard({
  event,
  priority = false,
}: WeekendEventCardProps) {
  if (!event.image) {
    return <WeekendTextEventCard event={event} />;
  }
  return <WeekendImageEventCard event={event} priority={priority} />;
}

function WeekendImageEventCard({
  event,
  priority,
}: {
  event: EventItem;
  priority: boolean;
}) {
  const href = eventPublicPath(event.id);
  const imageSrc: string = event.image!;
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);

  return (
    <article className="group relative flex h-full gap-3 md:flex-col md:gap-0">
      <Link
        href={href}
        className="absolute inset-0 z-[1] rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        aria-label={event.title}
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
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col py-0.5 md:pt-2.5">
        <div className="min-w-0">
          <CategoryBadge event={event} className="px-2 py-1" />
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-[1.15rem] font-semibold leading-[1.08] tracking-tight text-ink md:text-[1.2rem]">
          {event.title}
        </h3>
        <div className="mt-auto space-y-1.5 pt-1.5 text-sm md:pt-2">
          <EventPlaceDateLines venue={event.venue} whenLabel={whenLabel} />
          <LocationLine
            city={event.city}
            distanceKm={event.distanceKm}
            cityClassName="text-cream-dim"
            sepClassName="text-sand"
            distanceClassName="font-medium text-ink"
          />
          {priceLabel ? (
            <p className="hidden font-medium text-ink md:block">{priceLabel}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function WeekendTextEventCard({ event }: { event: EventItem }) {
  const href = eventPublicPath(event.id);
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);
  const { pastel, accent } = resolveNoImageCardTone(event);

  return (
    <article
      className={cn(
        "group relative flex h-full min-h-[15.5rem] flex-col overflow-hidden",
        pastel,
      )}
    >
      <Link
        href={href}
        className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        aria-label={event.title}
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
        <div className="min-w-0">
          <CategoryBadge event={event} className="px-2 py-1" />
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
