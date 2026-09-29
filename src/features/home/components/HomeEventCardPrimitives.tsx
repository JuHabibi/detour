"use client";

import { useId } from "react";
import { BookmarkCheck } from "lucide-react";
import { formatDistanceKm } from "@/application/format-distance";
import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import { resolveCategoryBadgeTone } from "@/components/event/category-badge-style";
import {
  EventCalendarClockIcon,
  EventMapPinIcon,
} from "@/components/event/event-lucide-icons";
import type {
  EventDetailSurface,
  OpenEventDetailHandler,
} from "@/components/event/EventDetailModal";
import type { EditorialBadge } from "@/domain/editorial/resolve-editorial-badge";
import type { CategoryId, EventItem, EventSignal } from "@/data/types";
import { getEditorialBadgeExplanation } from "@/features/home/editorial-badge-copy";
import { captureProductEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export type HomeEventCardProps = {
  event: EventItem;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  carnetCount?: number;
  onOrganizeCarnets?: (event: EventItem) => void;
  priority?: boolean;
  onOpenDetail?: OpenEventDetailHandler;
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

export function resolveNoImageCardTone(event: EventItem): {
  pastel: string;
  accent: string;
} {
  const category = event.category === "tout" ? "Autre" : event.category;
  return {
    pastel: pastelByCategory[category],
    accent: accentByCategory[category],
  };
}

export function EventPlaceDateLines({
  venue,
  whenLabel,
  reservePlaceLine = false,
  className,
}: {
  venue?: string | null;
  whenLabel: string;
  reservePlaceLine?: boolean;
  className?: string;
}) {
  const place = venue?.trim() ?? "";
  const showPlace = Boolean(place) || reservePlaceLine;

  return (
    <div className={cn("flex flex-col gap-1.5 text-sm", className)}>
      {showPlace ? (
        <p className="grid min-h-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2.5 text-cream-dim">
          {place ? (
            <EventMapPinIcon />
          ) : (
            <span aria-hidden className="size-4" />
          )}
          <span className="truncate">{place || "\u00a0"}</span>
        </p>
      ) : null}
      <p className="grid min-h-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2.5 text-[13px] italic text-sand">
        <EventCalendarClockIcon />
        <span className="truncate">{whenLabel}</span>
      </p>
    </div>
  );
}

export function CategoryBadge({
  event,
  className,
}: {
  event: Pick<EventItem, "category" | "genre" | "sourceCategory">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate px-1.5 py-0.5",
        "text-[11px] font-medium uppercase tracking-[0.12em]",
        resolveCategoryBadgeTone(event.category),
        className,
      )}
    >
      {resolveCategoryBadgeLabel(event)}
    </span>
  );
}

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
    <span
      className={cn(
        "group/edbadge relative z-[2] inline-flex min-w-0 max-w-full",
        tone !== "radar" && "mt-1.5",
      )}
    >
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1.5",
          "text-left text-[11px] font-semibold uppercase tracking-[0.08em]",
          "transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          tone === "radar"
            ? "min-w-0 border-0 bg-transparent p-0 font-medium tracking-[0.12em] text-sand"
            : "border border-transparent bg-transparent px-0 py-0.5 text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral",
        )}
        aria-describedby={tooltipId}
        onClick={(event) => isolateCardAction(event, () => undefined)}
      >
        <span className="truncate">{label}</span>
        <span
          aria-hidden
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center text-[8px] font-semibold leading-none",
            tone === "radar" ? "text-sand/60" : "text-sand",
          )}
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

export function canOpenEventDetail(
  event: EventItem,
  onOpenDetail: OpenEventDetailHandler | undefined,
): boolean {
  if (onOpenDetail) return true;
  return Boolean(resolveEventAction(event).href);
}

export function EventOpenControl({
  event,
  surface,
  onOpenDetail,
}: {
  event: EventItem;
  surface: EventDetailSurface;
  onOpenDetail?: OpenEventDetailHandler;
}) {
  if (onOpenDetail) {
    return (
      <button
        type="button"
        className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        aria-label={`Voir le détail — « ${event.title} »`}
        onClick={(clickEvent) => {
          openEventDetail(
            event,
            surface,
            clickEvent.currentTarget,
            onOpenDetail,
          );
        }}
      />
    );
  }

  const action = resolveEventAction(event);
  if (!action.href) return null;

  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute inset-0 z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      aria-label={`${action.label} — « ${event.title} » (nouvel onglet)`}
      onClick={() => {
        const properties = {
          event_id: event.id,
          city: event.city,
          category: event.category,
          source: event.source ?? null,
          section: surface,
        };
        captureProductEvent(
          surface === "radar" ? "radar_event_opened" : "explorer_event_opened",
          properties,
        );
      }}
    />
  );
}

export function openEventDetail(
  event: EventItem,
  surface: EventDetailSurface,
  trigger: HTMLElement,
  onOpenDetail: OpenEventDetailHandler,
) {
  onOpenDetail(event, surface, trigger);
}

type IsolatedCardActionEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

export function isolateCardAction(
  event: IsolatedCardActionEvent,
  action: () => void,
) {
  event.preventDefault();
  event.stopPropagation();
  action();
}

function FavoriteButton({
  isFavorite,
  onClick,
  className,
  eventTitle,
  opensOrganize = false,
}: {
  isFavorite: boolean;
  onClick: () => void;
  className?: string;
  eventTitle: string;
  opensOrganize?: boolean;
}) {
  const ariaLabel = !isFavorite
    ? `Ajouter « ${eventTitle} » aux favoris`
    : opensOrganize
      ? `Ranger « ${eventTitle} » dans un carnet`
      : `Retirer « ${eventTitle} » des favoris`;

  return (
    <button
      type="button"
      onClick={(event) => isolateCardAction(event, onClick)}
      aria-pressed={isFavorite}
      aria-label={ariaLabel}
      className={cn(
        "flex size-11 items-center justify-center border border-line bg-paper/95 text-ink transition-colors hover:bg-mint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
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

function CarnetStatusBadge({
  count,
  onClick,
  eventTitle,
  className,
}: {
  count: number;
  onClick: () => void;
  eventTitle: string;
  className?: string;
}) {
  if (count <= 0) return null;

  const label = count === 1 ? "Dans un carnet" : `Dans ${count} carnets`;

  return (
    <button
      type="button"
      onClick={(event) => isolateCardAction(event, onClick)}
      aria-label={`${label} — modifier le classement de « ${eventTitle} »`}
      className={cn(
        "inline-flex w-auto max-w-[11rem] shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1.5 text-[10px] font-medium leading-none tracking-[0.04em] text-foam transition-colors",
        "hover:bg-coral hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
        className,
      )}
    >
      <BookmarkCheck
        aria-hidden
        className="size-3 shrink-0"
        strokeWidth={2}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function CardFavoriteActions({
  event,
  isFavorite,
  onToggleFavorite,
  carnetCount = 0,
  onOrganizeCarnets,
  className,
}: {
  event: EventItem;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  carnetCount?: number;
  onOrganizeCarnets?: (event: EventItem) => void;
  className?: string;
}) {
  const favorited = Boolean(isFavorite);
  const canOrganize = Boolean(onOrganizeCarnets);
  const showHeart = Boolean(onToggleFavorite) || (favorited && canOrganize);
  const showBadge = favorited && carnetCount > 0 && canOrganize;

  if (!showHeart && !showBadge) return null;

  function handleHeartClick() {
    runHomeFavoriteAction({
      event,
      favorited,
      onToggleFavorite,
      onOrganizeCarnets,
    });
  }

  return (
    <div className={cn("z-[2] flex flex-col items-end gap-2", className)}>
      {showHeart ? (
        <FavoriteButton
          isFavorite={favorited}
          onClick={handleHeartClick}
          eventTitle={event.title}
          opensOrganize={favorited && canOrganize}
        />
      ) : null}
      {showBadge ? (
        <CarnetStatusBadge
          count={carnetCount}
          onClick={() => onOrganizeCarnets?.(event)}
          eventTitle={event.title}
        />
      ) : null}
    </div>
  );
}

export function runHomeFavoriteAction({
  event,
  favorited,
  onToggleFavorite,
  onOrganizeCarnets,
}: {
  event: EventItem;
  favorited: boolean;
  onToggleFavorite?: (id: string) => void;
  onOrganizeCarnets?: (event: EventItem) => void;
}) {
  if (!favorited) {
    onToggleFavorite?.(event.id);
    return;
  }
  if (onOrganizeCarnets) {
    onOrganizeCarnets(event);
    return;
  }
  onToggleFavorite?.(event.id);
}

export function resolveEventImageAlt(
  event: Pick<EventItem, "title" | "imageAlt">,
): string {
  const custom = event.imageAlt?.trim();
  if (custom && custom !== event.title) return custom;
  return "";
}

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

export function resolveSignal(event: EventItem): string | null {
  if (event.signal && signalLabels[event.signal]) {
    return signalLabels[event.signal] ?? null;
  }
  return null;
}

export function formatPrice(price: EventItem["price"]): string | null {
  if (price == null) return null;
  return price === "free" ? "Gratuit" : `${price} €`;
}

export function LocationLine({
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
