import type { DetourEvent } from "@/domain/event";
import { ORLEANS_CENTER, distanceKmBetween } from "@/domain/geo";
import type { CategoryId, EventItem } from "@/data/types";

export function mapDetourEventToEventItem(event: DetourEvent): EventItem {
  const start = new Date(event.startAt);

  return {
    id: event.id,
    title: event.title,
    category: mapCategory(event.category),
    genre: formatGenre(event.category),
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
    relevance: event.relevance,
    relevanceReason: event.relevanceReason,
    weekend: isWeekendDay(start),
  };
}

function computeDistanceKm(event: DetourEvent): number | undefined {
  if (event.latitude == null || event.longitude == null) {
    return undefined;
  }

  return distanceKmBetween(ORLEANS_CENTER, {
    latitude: event.latitude,
    longitude: event.longitude,
  });
}

function mapCategory(raw: string | null): CategoryId {
  if (!raw) return "other";

  const value = raw.toLowerCase();
  if (value.includes("musique") || value.includes("concert")) return "musique";
  if (
    value.includes("cinéma") ||
    value.includes("cinema") ||
    value.includes("projection")
  ) {
    return "cinema";
  }
  if (value.includes("expo") || value.includes("patrimoine")) return "expos";
  if (value.includes("famille") || value.includes("enfant")) return "famille";
  if (
    value.includes("atelier") ||
    value.includes("stage") ||
    value.includes("conférence") ||
    value.includes("rencontre")
  ) {
    return "ateliers";
  }
  if (
    value.includes("spectacle") ||
    value.includes("théâtre") ||
    value.includes("theatre") ||
    value.includes("danse") ||
    value.includes("humour")
  ) {
    return "spectacles";
  }

  return "other";
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
