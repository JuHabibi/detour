import { wallTimeToIso } from "@/infrastructure/sources/shared/wall-time";
import type { DetourEvent } from "@/domain/events/event";
import type {
  SaranIcalDateValue,
  SaranIcalEvent,
} from "@/infrastructure/sources/saran/saran-ical.types";

export const SARAN_SOURCE_NAME = "Ville de Saran";
export const SARAN_CITY = "Saran";

/**
 * Mappe un VEVENT Saran vers DetourEvent.
 * DTEND iCal est exclusif (RFC 5545) — conservé tel quel en ISO.
 */
export function mapSaranIcalEventToDetourEvent(
  raw: SaranIcalEvent,
): DetourEvent | null {
  const startAt = saranDateToIso(raw.dtStart);
  if (!startAt) return null;

  const endAt = raw.dtEnd ? saranDateToIso(raw.dtEnd) : null;
  const allDay = raw.dtStart.kind === "date";

  return {
    id: `saran:${raw.uid}`,
    title: raw.summary.trim(),
    description: raw.description,
    imageUrl: null,
    startAt,
    endAt,
    ...(allDay ? { allDay: true as const } : {}),
    venue: raw.location,
    city: SARAN_CITY,
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: SARAN_SOURCE_NAME,
    sourceUrl: raw.url,
    registrationUrl: null,
  };
}

/** Convertit une date iCal Saran en ISO 8601 avec offset. */
export function saranDateToIso(value: SaranIcalDateValue): string | null {
  if (value.kind === "date") {
    return wallTimeToIso({
      year: value.year,
      month: value.month,
      day: value.day,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone: value.timeZone || "Europe/Paris",
    });
  }

  return wallTimeToIso(value);
}

/** Intersection [from, to] avec l’intervalle [start, end) (end exclusif si présent). */
export function saranEventIntersectsWindow(
  event: DetourEvent,
  from: Date,
  to: Date,
): boolean {
  const start = Date.parse(event.startAt);
  if (Number.isNaN(start)) return false;

  const end = event.endAt ? Date.parse(event.endAt) : Number.NaN;
  const exclusiveEnd = Number.isNaN(end) ? start + 1 : end;

  return start < to.getTime() && exclusiveEnd > from.getTime();
}
