"use client";

import Image from "next/image";
import { useId } from "react";
import { formatDistanceKm } from "@/application/format-distance";
import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import { getEditorialBadgeExplanation } from "@/components/editorial-badge-copy";
import type { EditorialBadge } from "@/domain/editorial/resolve-editorial-badge";
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
  /** Numéro éditorial radar (01, 02…) — présentation uniquement. */
  rank?: number;
  /** Surface visuelle : radar = affiche ; explorer = corpus. */
  surface?: "radar" | "explorer";
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
  Musique: "bg-mint-soft",
  Spectacle: "bg-mint-soft",
  Exposition: "bg-ink-3",
  Atelier: "bg-mint-soft",
  "Jeune public": "bg-ink-3",
  Rencontre: "bg-mint-soft",
  Visite: "bg-ink-3",
  "Fête / salon / marché": "bg-mint-soft",
  "Loisirs culturels": "bg-ink-3",
  Autre: "bg-ink-3",
};

const accentByCategory: Record<Exclude<CategoryId, "tout">, string> = {
  Musique: "bg-mint/25",
  Spectacle: "bg-mint/25",
  Exposition: "bg-ink/10",
  Atelier: "bg-mint/25",
  "Jeune public": "bg-ink/10",
  Rencontre: "bg-mint/25",
  Visite: "bg-ink/10",
  "Fête / salon / marché": "bg-mint/25",
  "Loisirs culturels": "bg-ink/10",
  Autre: "bg-ink/10",
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
      <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[16/10] lg:aspect-auto lg:min-h-0 lg:flex-1">
        <Image
          src={event.image}
          alt={resolveEventImageAlt(event)}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 58vw"
          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        <div className="absolute left-0 top-0 z-[2] flex flex-wrap gap-0">
          <span className="bg-mint px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
            {resolveCategoryBadgeLabel(event)}
          </span>
          {signal ? (
            <span className="bg-ink px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-foam">
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
    rank,
    surface = "explorer",
  } = props;
  if (!event.image) {
    return (
      <TextEventCard
        {...props}
        featured={emphasis || layout === "row" || surface === "radar"}
      />
    );
  }

  const imageSrc: string = event.image;
  const priceLabel = formatPrice(event.price);
  const whenLabel = formatWhen(event);
  const signal = resolveSignal(event);
  const isRadar = surface === "radar";
  const rankLabel =
    typeof rank === "number"
      ? String(rank).padStart(2, "0")
      : null;

  if (layout === "row") {
    return (
      <article
        className={cn(
          "group relative flex h-full min-h-[7.5rem] gap-3.5 sm:min-h-[8.25rem] sm:gap-4",
          resolveEventAction(event).href && "cursor-pointer",
        )}
      >
        <EventActionLink event={event} />
        <div className="relative w-[38%] max-w-[11.5rem] shrink-0 overflow-hidden sm:w-[40%]">
          <Image
            src={imageSrc}
            alt={resolveEventImageAlt(event)}
            fill
            priority={priority}
            sizes="(max-width: 1024px) 40vw, 18vw"
            className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
          />
          {signal ? (
            <span className="absolute left-2 top-2 z-[2] bg-ink px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foam">
              {signal}
            </span>
          ) : null}
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col border-b border-line py-0.5 pr-1 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
                {resolveCategoryBadgeLabel(event)}
              </p>
              <EditorialBadgePill label={event.editorialBadge} />
              <AvailabilityBadgePill label={event.availabilityBadge} />
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

  if (isRadar) {
    const reason =
      event.editorialBadge ??
      resolveSignal(event) ??
      resolveCategoryBadgeLabel(event);

    return (
      <article
        className={cn(
          "group relative flex h-full flex-col text-ink",
          resolveEventAction(event).href && "cursor-pointer",
        )}
      >
        <EventActionLink event={event} />
        <div className="relative aspect-[5/6] overflow-hidden bg-ink/10">
          <Image
            src={imageSrc}
            alt={resolveEventImageAlt(event)}
            fill
            priority={priority}
            sizes="(max-width: 640px) 72vw, (max-width: 1024px) 32vw, 26vw"
            className="object-cover object-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
          />
          {onToggleFavorite ? (
            <FavoriteButton
              isFavorite={isFavorite}
              onClick={() => onToggleFavorite(event.id)}
              eventTitle={event.title}
              className="absolute right-2 top-2 z-[2] border-0 bg-foam/90"
            />
          ) : null}
        </div>

        <div className="relative pt-2.5">
          <div className="flex items-baseline gap-2">
            {rankLabel ? (
              <span className="shrink-0 font-display text-[1.35rem] leading-none tracking-tight text-coral md:text-[1.5rem]">
                {rankLabel}
              </span>
            ) : null}
            <p className="min-w-0 text-[11px] font-medium uppercase tracking-[0.1em] text-ink/75">
              {reason}
            </p>
          </div>
          {event.availabilityBadge ? (
            <AvailabilityBadgePill label={event.availabilityBadge} />
          ) : null}
          <h3 className="mt-1.5 line-clamp-3 font-display text-[1.25rem] leading-[1.02] tracking-tight text-ink md:text-[1.4rem]">
            {event.title}
          </h3>
          {event.venue ? (
            <p className="mt-1.5 line-clamp-1 text-sm text-ink/70">{event.venue}</p>
          ) : null}
          <p className="mt-0.5 text-sm font-medium text-ink">{whenLabel}</p>
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
      <div className="relative aspect-[3/4] overflow-hidden bg-ink-3">
        <Image
          src={imageSrc}
          alt={resolveEventImageAlt(event)}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover object-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        {onToggleFavorite ? (
          <FavoriteButton
            isFavorite={isFavorite}
            onClick={() => onToggleFavorite(event.id)}
            eventTitle={event.title}
            className="absolute right-2 top-2 z-[2] border-0 bg-foam/90"
          />
        ) : null}
      </div>

      <div className="relative flex flex-1 flex-col pt-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand">
          {resolveCategoryBadgeLabel(event)}
        </p>
        <EditorialBadgePill label={event.editorialBadge} />
        <AvailabilityBadgePill label={event.availabilityBadge} />
        <h3 className="mt-1.5 line-clamp-2 font-display text-[1.45rem] leading-[1.05] tracking-tight text-ink md:text-[1.55rem]">
          {event.title}
        </h3>
        {event.venue ? (
          <p className="mt-2 line-clamp-1 text-sm text-cream-dim">{event.venue}</p>
        ) : null}
        <div className="mt-auto space-y-0.5 pt-3.5 text-sm">
          <p className="text-cream-dim">{whenLabel}</p>
          {priceLabel ? <p className="font-medium text-ink">{priceLabel}</p> : null}
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
        "group relative flex h-full flex-col overflow-hidden",
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
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
              {resolveCategoryBadgeLabel(event)}
            </p>
            <EditorialBadgePill label={event.editorialBadge} />
              <AvailabilityBadgePill label={event.availabilityBadge} />
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
          <p className="mt-3 text-[12px] font-medium uppercase tracking-[0.1em] text-sand">{signal}</p>
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

/**
 * Pastille disponibilité billetterie — label déjà résolu hors UI.
 * Uniquement « Complet » / « Complet en ligne ».
 */
export function AvailabilityBadgePill({
  label,
}: {
  label?: EventItem["availabilityBadge"];
}) {
  if (!label) return null;
  return (
    <span
      className={cn(
        "mt-1 inline-flex max-w-full items-center",
        "text-[11px] font-semibold uppercase tracking-[0.06em] text-coral",
      )}
    >
      {label}
    </span>
  );
}

/**
 * Pastille éditoriale — label déjà résolu hors UI.
 * Variante B : cartouche rectangulaire (plus pill).
 */
export function EditorialBadgePill({
  label,
  tone = "default",
}: {
  label?: EditorialBadge;
  tone?: "default" | "radar";
}) {
  const tooltipId = useId();
  if (!label) return null;

  const explanation = getEditorialBadgeExplanation(label);

  return (
    <span className="group/edbadge relative z-[2] mt-1.5 inline-flex max-w-full">
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-2",
          "border px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em]",
          "transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          tone === "radar"
            ? "border-transparent bg-transparent px-0 py-0.5 text-ink underline decoration-mint decoration-2 underline-offset-4"
            : "border-transparent bg-transparent px-0 py-0.5 text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral",
        )}
        aria-describedby={tooltipId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <span className="truncate">{label}</span>
        <span
          aria-hidden
          className="flex size-3.5 shrink-0 items-center justify-center text-[8px] font-semibold leading-none text-sand"
        >
          i
        </span>
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-0 top-[calc(100%+0.4rem)] z-20",
          "w-max max-w-[15.5rem] border border-line bg-paper px-2.5 py-2",
          "text-[12px] leading-snug text-cream-dim shadow-sm",
          "opacity-0 transition-opacity duration-150",
          "group-hover/edbadge:opacity-100 group-focus-within/edbadge:opacity-100",
          "motion-reduce:transition-none",
        )}
      >
        {explanation}
      </span>
    </span>
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
      className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
        "flex size-11 items-center justify-center border border-line bg-paper/95 text-ink transition-colors hover:bg-mint/40",
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

/** Action carte : pas de « Réserver » si billetterie sold_out*. */
export function resolveEventAction(event: EventItem): {
  href?: string;
  label: string;
} {
  if (
    event.availabilityStatus === "sold_out" ||
    event.availabilityStatus === "sold_out_online"
  ) {
    if (event.sourceUrl) {
      return { href: event.sourceUrl, label: "Voir les infos" };
    }
    return { label: "Voir les infos" };
  }

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
  // allDay : dateLabel déjà calculé sur la borne inclusive — ne pas comparer endAt brut.
  if (event.allDay) {
    return event.dateLabel;
  }
  if (isMultiDayCivilParis(event)) {
    return event.dateLabel;
  }
  // Version compacte pour les cartes (densité).
  const label = formatCompactDateLabel(event.date);
  return event.time ? `${label} · ${event.time}` : label;
}

/** Exporté pour tests — label affiché sur les cards. */
export { formatWhen };

function isMultiDayCivilParis(event: EventItem): boolean {
  if (!event.startAt || !event.endAt) return false;
  const startKey = toParisDateKey(event.startAt);
  const endKey = toParisDateKey(event.endAt);
  if (!startKey || !endKey) return false;
  return startKey !== endKey;
}

function toParisDateKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
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
