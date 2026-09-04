import { classifyEventCategory } from "@/domain/classify-event-category";
import type { DetourEvent } from "@/domain/event";
import {
  ORLEANS_CENTER,
  distanceKmBetween,
  resolveEventCoordinates,
} from "@/domain/geo";
import { resolveEditorialBadge } from "@/domain/resolve-editorial-badge";
import type { EventHighlight } from "@/domain/select-detour-highlights";
import type { EventItem } from "@/data/types";

export function mapDetourEventToEventItem(event: DetourEvent): EventItem {
  const start = new Date(event.startAt);

  return {
    id: event.id,
    title: event.title,
    category: classifyEventCategory(event),
    genre: formatGenre(event.category) || event.genre?.trim() || "",
    venue: event.venue,
    city: event.city,
    date: toDateKey(start),
    dateLabel: formatDateLabel(start),
    startAt: event.startAt,
    endAt: event.endAt,
    time: formatTime(start),
    distanceKm: computeDistanceKm(event),
    image: event.imageUrl ?? undefined,
    description: event.description ?? undefined,
    sourceUrl: event.sourceUrl ?? undefined,
    registrationUrl: event.registrationUrl ?? undefined,
    source: event.source ?? undefined,
    conditions: event.conditions ?? undefined,
    sourceCategory: event.category,
    relevance: event.relevance,
    relevanceReason: event.relevanceReason,
    weekend: isWeekendDay(start),
  };
}

/**
 * Mapping highlight « Faites un détour » → UI, avec pastille éditoriale si assessment IA.
 */
export function mapDetourHighlightToEventItem(
  highlight: EventHighlight,
): EventItem {
  const item = mapDetourEventToEventItem(highlight.event);
  const ai = highlight.aiSelection;
  if (!ai) return item;

  const editorialBadge = resolveEditorialBadge({
    planningNeed: ai.planningNeed,
    localRarity: ai.localRarity,
    likelyDemand: ai.likelyDemand,
    missRisk: ai.missRisk,
    hasRegistrationUrl: Boolean(highlight.event.registrationUrl),
  });

  return editorialBadge ? { ...item, editorialBadge } : item;
}

/**
 * Label / badge carte : sourceCategory → genre → catégorie produit.
 * Le filtre continue d’utiliser `event.category`.
 */
export function resolveCategoryBadgeLabel(
  event: Pick<EventItem, "category" | "genre" | "sourceCategory">,
): string {
  const fromSource = formatGenre(event.sourceCategory ?? null);
  if (fromSource) return fromSource;

  const fromGenre = event.genre?.trim();
  if (fromGenre) return fromGenre;

  if (event.category && event.category !== "tout") return event.category;
  return "Autre";
}

function computeDistanceKm(event: DetourEvent): number | undefined {
  const point = resolveEventCoordinates(event);
  if (!point) return undefined;
  return distanceKmBetween(ORLEANS_CENTER, point);
}

/** Samedi (6) et dimanche (0) uniquement. */
function isWeekendDay(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(date);

  return weekday === "Sat" || weekday === "Sun";
}

function toDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date): string {
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return capitalizeFr(label);
}

function formatGenre(raw: string | null): string {
  if (!raw) return "";

  return raw
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(":", "h");
}

function capitalizeFr(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
