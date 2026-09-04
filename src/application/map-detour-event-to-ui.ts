import type { DetourEvent } from "@/domain/event";
import type { CategoryId, EventItem } from "@/data/types";

/** Fallback temporaire tant que la distance n’est pas calculée. */
const FALLBACK_DISTANCE_KM = 5;

const DAY_MS = 86_400_000;

/**
 * Pont temporaire DetourEvent → EventItem pour la maquette actuelle.
 * Les champs éditoriaux (distance, prix, sections) restent en fallback simple.
 */
export function mapDetourEventToEventItem(
  event: DetourEvent,
  now: Date = new Date(),
): EventItem {
  const start = new Date(event.startAt);
  const daysAhead = (start.getTime() - now.getTime()) / DAY_MS;
  const weekday = start.getDay();
  const isWeekendDay = weekday === 0 || weekday === 5 || weekday === 6;

  return {
    id: event.id,
    title: event.title,
    category: mapCategory(event.category),
    genre: event.category ?? "Événement",
    venue: event.venue ?? "Lieu à confirmer",
    city: event.city,
    date: toDateKey(start),
    dateLabel: formatDateLabel(start),
    time: formatTime(start),
    distanceKm: FALLBACK_DISTANCE_KM,
    price: "free",
    image: event.imageUrl ?? undefined,
    description: event.description ?? undefined,
    detour: daysAhead >= 0 && daysAhead <= 10,
    weekend: isWeekendDay && daysAhead >= 0 && daysAhead <= 7,
    upcoming: daysAhead > 14,
  };
}

function mapCategory(raw: string | null): CategoryId {
  if (!raw) return "spectacles";

  const value = raw.toLowerCase();
  if (value.includes("musique") || value.includes("concert")) return "musique";
  if (value.includes("cinéma") || value.includes("cinema") || value.includes("projection")) {
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

  return "spectacles";
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
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
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
