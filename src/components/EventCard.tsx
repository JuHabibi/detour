"use client";

import Image from "next/image";
import type { CategoryId, EventItem, EventSignal } from "@/data/types";
import { cn } from "@/lib/cn";

type CardProps = {
  event: EventItem;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  priority?: boolean;
};

type EventCardProps = CardProps & {
  variant?: "featured" | "standard" | "text";
};

const signalLabels: Partial<Record<EventSignal, string>> = {
  discover: "À découvrir",
  nearby: "Tout près",
  free: "Gratuit",
  intimate: "Petite jauge",
};

const pastelByCategory: Record<Exclude<CategoryId, "tout">, string> = {
  musique: "bg-coral/12",
  spectacles: "bg-lilac/20",
  expos: "bg-sky/20",
  cinema: "bg-mint/25",
  famille: "bg-sun/20",
  ateliers: "bg-blush/18",
};

const accentByCategory: Record<Exclude<CategoryId, "tout">, string> = {
  musique: "bg-coral/35",
  spectacles: "bg-lilac/40",
  expos: "bg-sky/40",
  cinema: "bg-mint/45",
  famille: "bg-sun/40",
  ateliers: "bg-blush/40",
};

export function EventCard({
  variant = "standard",
  ...props
}: EventCardProps) {
  if (variant === "text" || !props.event.image) {
    return <TextEventCard {...props} />;
  }
  if (variant === "featured") return <FeaturedEventCard {...props} />;
  return <StandardEventCard {...props} />;
}

export function FeaturedEventCard({
  event,
  isFavorite = false,
  onToggleFavorite,
  priority = false,
}: CardProps) {
  if (!event.image) return <TextEventCard event={event} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} featured />;

  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem] sm:aspect-[16/11] md:aspect-auto md:min-h-[21rem] md:flex-1">
        <Image
          src={event.image}
          alt={event.imageAlt ?? event.title}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 58vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-paper/92 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-ink">
            {event.genre}
          </span>
          {signal ? (
            <span className="rounded-full bg-coral/90 px-3 py-1 text-[11px] text-ink">
              {signal}
            </span>
          ) : null}
        </div>

        {onToggleFavorite ? (
          <FavoriteButton
            isFavorite={isFavorite}
            onClick={() => onToggleFavorite(event.id)}
            className="absolute right-4 top-4"
          />
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
          <h3 className="max-w-xl font-display text-[1.9rem] leading-[0.95] sm:text-4xl md:text-[2.45rem]">
            {event.title}
          </h3>
          <p className="mt-2.5 text-sm text-white/80">{event.venue}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-white/75">{event.city}</span>
                <span className="text-white/45"> · </span>
                <span className="font-medium text-white">{event.distanceKm} km</span>
              </p>
              <p className="text-white/75">{whenLabel}</p>
            </div>
            <p className="text-sm text-white/90">{priceLabel}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StandardEventCard(props: CardProps) {
  const { event, isFavorite = false, onToggleFavorite, priority = false } = props;
  if (!event.image) return <TextEventCard {...props} />;

  const imageSrc: string = event.image;
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.2rem]">
        <Image
          src={imageSrc}
          alt={event.imageAlt ?? event.title}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        {signal ? (
          <span className="absolute left-3 top-3 rounded-full bg-paper/92 px-2.5 py-1 text-[10px] text-ink">
            {signal}
          </span>
        ) : null}
        {onToggleFavorite ? (
          <FavoriteButton
            isFavorite={isFavorite}
            onClick={() => onToggleFavorite(event.id)}
            className="absolute right-3 top-3"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-0.5 pb-1 pt-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-sand">
          {event.genre}
        </p>
        <h3 className="mt-1.5 font-display text-[1.4rem] leading-tight">
          {event.title}
        </h3>
        <p className="mt-2 text-sm text-cream-dim">{event.venue}</p>
        <p className="mt-1 text-sm">
          <span className="text-cream-dim">{event.city}</span>
          <span className="text-sand"> · </span>
          <span className="font-medium text-ink">{event.distanceKm} km</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3 text-sm">
          <p className="text-cream-dim">{whenLabel}</p>
          <p className="text-ink">{priceLabel}</p>
        </div>
      </div>
    </article>
  );
}

export function TextEventCard({
  event,
  isFavorite = false,
  onToggleFavorite,
  featured = false,
}: CardProps & { featured?: boolean }) {
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);
  const categoryKey =
    event.category === "tout" ? "musique" : event.category;
  const pastel = pastelByCategory[categoryKey];
  const accent = accentByCategory[categoryKey];

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.25rem]",
        pastel,
        featured ? "min-h-[16rem] md:min-h-[21rem]" : "min-h-[15.5rem]",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-6 -top-8 size-24 rounded-full opacity-70",
          accent,
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-10 -left-4 size-20 rotate-12 rounded-[1.1rem] opacity-50",
          accent,
        )}
      />

      <div className="relative flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-sand">
            {event.genre}
          </p>
          {onToggleFavorite ? (
            <FavoriteButton
              isFavorite={isFavorite}
              onClick={() => onToggleFavorite(event.id)}
              className="shrink-0 bg-paper/70"
            />
          ) : null}
        </div>

        {signal ? (
          <p className="mt-3 text-[12px] italic text-cream-dim">{signal}</p>
        ) : null}

        <h3
          className={cn(
            "mt-3 font-display leading-[1.05] tracking-tight",
            featured
              ? "text-[1.85rem] md:text-[2.2rem]"
              : "text-[1.55rem] md:text-[1.7rem]",
          )}
        >
          {event.title}
        </h3>

        {event.description ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-cream-dim">
            {event.description}
          </p>
        ) : null}

        <div className="mt-auto space-y-2 pt-6 text-sm">
          <p className="text-cream-dim">{event.venue}</p>
          <p>
            <span className="text-cream-dim">{event.city}</span>
            <span className="text-sand"> · </span>
            <span className="font-medium text-ink">{event.distanceKm} km</span>
          </p>
          <div className="flex items-end justify-between gap-3 pt-1">
            <p className="text-cream-dim">{whenLabel}</p>
            <p className="text-ink">{priceLabel}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function resolveSignal(event: EventItem) {
  if (event.signal && signalLabels[event.signal]) {
    return signalLabels[event.signal];
  }
  return null;
}

function formatPrice(price: EventItem["price"]) {
  return price === "free" ? "Gratuit" : `${price} €`;
}

function formatWhen(event: EventItem) {
  return event.time ? `${event.dateLabel} · ${event.time}` : event.dateLabel;
}

function FavoriteButton({
  isFavorite,
  onClick,
  className,
}: {
  isFavorite: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-paper/90 text-ink backdrop-blur-sm transition-colors hover:bg-paper",
        className,
      )}
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
  );
}
