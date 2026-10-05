"use client";

import { useId } from "react";
import { formatDistanceKm } from "@/application/format-distance";
import { resolveCategoryBadgeLabel } from "@/application/map-detour-event-to-ui";
import { resolveCategoryBadgeTone } from "@/components/event/category-badge-style";
import {
  EventCalendarClockIcon,
  EventMapPinIcon,
} from "@/components/event/event-lucide-icons";
import type { EditorialBadge } from "@/domain/editorial/resolve-editorial-badge";
import type { CategoryId, EventItem, EventSignal } from "@/data/types";
import { getEditorialBadgeExplanation } from "@/features/home/editorial-badge-copy";
import { cn } from "@/lib/cn";

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
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
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

export function resolveEventImageAlt(
  event: Pick<EventItem, "title" | "imageAlt">,
): string {
  const custom = event.imageAlt?.trim();
  if (custom && custom !== event.title) return custom;
  return "";
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
