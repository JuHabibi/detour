import { parisCalendarYear } from "@/domain/time/paris-calendar-year";
import type { EventItem } from "@/data/types";

/** Label date/heure compact pour cartes événement (Radar, Explorer, Frise). */
export function formatWhen(event: EventItem) {
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
  // Midi local sur la clé civile Paris — même convention qu’avant.
  const date = new Date(`${dateKey}T12:00:00`);
  const eventYear = dateKey.slice(0, 4);
  const showYear =
    Boolean(eventYear) && eventYear !== parisCalendarYear(new Date());

  // Avec année : pas de weekday (place limitée, line-clamp-1) pour garder l’année lisible.
  const label = new Intl.DateTimeFormat("fr-FR", {
    ...(showYear
      ? { day: "numeric" as const, month: "short" as const, year: "numeric" as const }
      : {
          weekday: "short" as const,
          day: "numeric" as const,
          month: "short" as const,
        }),
  }).format(date);

  // "sam. 12 sept." → "Sam. 12 sept." ; "10 mars 2027" inchangé en casse utile
  return label.charAt(0).toUpperCase() + label.slice(1);
}
