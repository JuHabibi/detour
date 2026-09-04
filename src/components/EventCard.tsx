"use client";

import Image from "next/image";
import { formatDistanceKm } from "@/application/format-distance";
import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import type { CategoryId, EventItem, EventSignal } from "@/data/types";
import { cn } from "@/lib/cn";

type CardProps = {
  event: EventItem;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  priority?: boolean;
  /** row = image + texte côte à côte (section éditoriale). */
  layout?: "stack" | "row";
  /** Hiérarchie légère (titre) — pas une carte hero. */
  emphasis?: boolean;
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
  Musique: "bg-coral/12",
  Spectacle: "bg-lilac/20",
  Exposition: "bg-sky/20",
  Atelier: "bg-blush/18",
  "Jeune public": "bg-sun/20",
  Rencontre: "bg-mint/25",
  Visite: "bg-sand/15",
  "Fête / salon / marché": "bg-sun/15",
  "Loisirs culturels": "bg-mint/20",
  Autre: "bg-sand/15",
};

const accentByCategory: Record<Exclude<CategoryId, "tout">, string> = {
  Musique: "bg-coral/35",
  Spectacle: "bg-lilac/40",
  Exposition: "bg-sky/40",
  Atelier: "bg-blush/40",
  "Jeune public": "bg-sun/40",
  Rencontre: "bg-mint/45",
  Visite: "bg-sand/30",
  "Fête / salon / marché": "bg-sun/35",
  "Loisirs culturels": "bg-mint/40",
  Autre: "bg-sand/30",
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
    <article
      className={cn(
        "group relative flex h-full flex-col",
        resolveEventAction(event).href && "cursor-pointer",
      )}
    >
      <EventActionLink event={event} />
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem] sm:aspect-[16/10] lg:aspect-auto lg:min-h-0 lg:flex-1">
        <Image
          src={event.image}
          alt={resolveEventImageAlt(event)}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 58vw"
          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute left-4 top-4 z-[2] flex flex-wrap gap-2">
          <span className="rounded-full bg-paper/92 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-ink">
            {resolveCategoryBadgeLabel(event)}
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
            eventTitle={event.title}
            className="absolute right-4 top-4 z-[2]"
          />
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-5 lg:p-6">
          <h3 className="max-w-xl font-display text-[1.75rem] leading-[0.98] sm:text-[2.1rem] lg:text-[2.2rem]">
            {event.title}
          </h3>
          {event.venue ? (
            <p className="mt-2 text-sm text-white/80">{event.venue}</p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1 text-sm">
              <LocationLine
                city={event.city}
                distanceKm={event.distanceKm}
                cityClassName="text-white/75"
                sepClassName="text-white/45"
                distanceClassName="font-medium text-white"
              />
              <p className="text-white/75">{whenLabel}</p>
            </div>
            {priceLabel ? (
              <p className="text-sm text-white/90">{priceLabel}</p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function StandardEventCard(props: CardProps) {
  const {
    event,
    isFavorite = false,
    onToggleFavorite,
    priority = false,
    layout = "stack",
    emphasis = false,
  } = props;
  if (!event.image) {
    return (
      <TextEventCard
        {...props}
        featured={emphasis || layout === "row"}
      />
    );
  }

  const imageSrc: string = event.image;
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);

  if (layout === "row") {
    return (
      <article
        className={cn(
          "group relative flex h-full min-h-[7.5rem] gap-3.5 sm:min-h-[8.25rem] sm:gap-4",
          resolveEventAction(event).href && "cursor-pointer",
        )}
      >
        <EventActionLink event={event} />
        <div className="relative w-[38%] max-w-[11.5rem] shrink-0 overflow-hidden rounded-[1.05rem] sm:w-[40%]">
          <Image
            src={imageSrc}
            alt={resolveEventImageAlt(event)}
            fill
            priority={priority}
            sizes="(max-width: 1024px) 40vw, 18vw"
            className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
          />
          {signal ? (
            <span className="absolute left-2.5 top-2.5 z-[2] rounded-full bg-paper/92 px-2 py-0.5 text-[10px] text-ink">
              {signal}
            </span>
          ) : null}
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col py-0.5 pr-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.14em] text-sand">
                {resolveCategoryBadgeLabel(event)}
              </p>
              <EditorialBadgePill label={event.editorialBadge} />
            </div>
            {onToggleFavorite ? (
              <FavoriteButton
                isFavorite={isFavorite}
                onClick={() => onToggleFavorite(event.id)}
                eventTitle={event.title}
                className="relative z-[2] shrink-0"
              />
            ) : null}
          </div>
          <h3 className="mt-1 font-display text-[1.35rem] leading-tight sm:text-[1.45rem]">
            {event.title}
          </h3>
          {event.venue ? (
            <p className="mt-1.5 line-clamp-1 text-sm text-cream-dim">
              {event.venue}
            </p>
          ) : null}
          <div className="mt-1 text-sm">
            <LocationLine
              city={event.city}
              distanceKm={event.distanceKm}
              cityClassName="text-cream-dim"
              sepClassName="text-sand"
              distanceClassName="font-medium text-ink"
            />
          </div>
          <div className="mt-auto flex items-end justify-between gap-3 pt-2 text-sm">
            <p className="text-cream-dim">{whenLabel}</p>
            {priceLabel ? <p className="text-ink">{priceLabel}</p> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col",
        resolveEventAction(event).href && "cursor-pointer",
      )}
    >
      <EventActionLink event={event} />
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.2rem]">
        <Image
          src={imageSrc}
          alt={resolveEventImageAlt(event)}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
          className="object-cover object-center transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        {signal ? (
          <span className="absolute left-3 top-3 z-[2] rounded-full bg-paper/92 px-2.5 py-1 text-[10px] text-ink">
            {signal}
          </span>
        ) : null}
        {onToggleFavorite ? (
          <FavoriteButton
            isFavorite={isFavorite}
            onClick={() => onToggleFavorite(event.id)}
            eventTitle={event.title}
            className="absolute right-3 top-3 z-[2]"
          />
        ) : null}
      </div>

        <div className="relative flex flex-1 flex-col px-0.5 pb-1 pt-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-sand">
          {resolveCategoryBadgeLabel(event)}
        </p>
        <EditorialBadgePill label={event.editorialBadge} />
        <h3 className="mt-1.5 line-clamp-2 font-display text-[1.4rem] leading-tight tracking-tight">
          {event.title}
        </h3>
        {event.venue ? (
          <p className="mt-2 line-clamp-1 text-sm text-cream-dim">{event.venue}</p>
        ) : null}
        <div className="mt-1 text-sm">
          <LocationLine
            city={event.city}
            distanceKm={event.distanceKm}
            cityClassName="text-cream-dim"
            sepClassName="text-sand"
            distanceClassName="font-medium text-ink"
          />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3 text-sm">
          <p className="text-cream-dim">{whenLabel}</p>
          {priceLabel ? <p className="text-ink">{priceLabel}</p> : null}
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
    event.category === "tout" ? "Autre" : event.category;
  const pastel = pastelByCategory[categoryKey];
  const accent = accentByCategory[categoryKey];

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.25rem]",
        pastel,
        featured
          ? "min-h-[14.5rem] md:min-h-[16.5rem] lg:min-h-0"
          : "min-h-[15.5rem]",
        resolveEventAction(event).href && "cursor-pointer",
      )}
    >
      <EventActionLink event={event} />
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
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-sand">
              {resolveCategoryBadgeLabel(event)}
            </p>
            <EditorialBadgePill label={event.editorialBadge} />
          </div>
          {onToggleFavorite ? (
            <FavoriteButton
              isFavorite={isFavorite}
              onClick={() => onToggleFavorite(event.id)}
              eventTitle={event.title}
              className="relative z-[2] shrink-0 bg-paper/70"
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
          {event.venue ? (
            <p className="text-cream-dim">{event.venue}</p>
          ) : null}
          <LocationLine
            city={event.city}
            distanceKm={event.distanceKm}
            cityClassName="text-cream-dim"
            sepClassName="text-sand"
            distanceClassName="font-medium text-ink"
          />
          <div className="flex items-end justify-between gap-3 pt-1">
            <p className="text-cream-dim">{whenLabel}</p>
            {priceLabel ? <p className="text-ink">{priceLabel}</p> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Affichage pur — le label est déjà résolu hors UI. */
function EditorialBadgePill({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <p className="mt-1.5 w-fit rounded-full border border-line bg-foam px-2.5 py-0.5 text-[11px] font-medium leading-none text-ink">
      {label}
    </p>
  );
}

function EventActionLink({ event }: { event: EventItem }) {
  const action = resolveEventAction(event);
  if (!action.href) return null;

  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute inset-0 z-[1] rounded-[1.2rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      aria-label={`${action.label} — « ${event.title} » (nouvel onglet)`}
    />
  );
}

/** Image carte : décorative si le titre est déjà visible (évite la double annonce). */
export function resolveEventImageAlt(
  event: Pick<EventItem, "title" | "imageAlt">,
): string {
  const custom = event.imageAlt?.trim();
  if (custom && custom !== event.title) return custom;
  return "";
}

function FavoriteButton({
  isFavorite,
  onClick,
  className,
  eventTitle,
}: {
  isFavorite: boolean;
  onClick: () => void;
  className?: string;
  eventTitle: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={isFavorite}
      aria-label={
        isFavorite
          ? `Retirer « ${eventTitle} » des favoris`
          : `Ajouter « ${eventTitle} » aux favoris`
      }
      className={cn(
        "flex size-11 items-center justify-center rounded-full bg-paper/90 text-ink backdrop-blur-sm transition-colors hover:bg-paper",
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

/** registrationUrl prioritaire, sinon fiche source (souvent OpenAgenda). */
function resolveEventAction(event: EventItem): {
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

function resolveSignal(event: EventItem) {
  if (event.signal && signalLabels[event.signal]) {
    return signalLabels[event.signal];
  }
  return null;
}

function formatPrice(price: EventItem["price"]): string | null {
  if (price == null) return null;
  return price === "free" ? "Gratuit" : `${price} €`;
}

function formatWhen(event: EventItem) {
  // Version compacte pour les cartes (densité).
  const label = formatCompactDateLabel(event.date);
  return event.time ? `${label} · ${event.time}` : label;
}

function formatCompactDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);

  // "sam. 12 sept." → "Sam. 12 sept."
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function LocationLine({
  city,
  distanceKm,
  cityClassName,
  sepClassName,
  distanceClassName,
}: {
  city: string | null;
  distanceKm?: number;
  cityClassName: string;
  sepClassName: string;
  distanceClassName: string;
}) {
  const hasCity = Boolean(city);
  const hasDistance = distanceKm != null;

  if (!hasCity && !hasDistance) return null;

  return (
    <p>
      {hasCity ? <span className={cityClassName}>{city}</span> : null}
      {hasCity && hasDistance ? (
        <span className={sepClassName}> · </span>
      ) : null}
      {hasDistance ? (
        <span className={distanceClassName}>
          {formatDistanceKm(distanceKm)}
        </span>
      ) : null}
    </p>
  );
}
