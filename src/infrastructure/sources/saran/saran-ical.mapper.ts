import type { DetourEvent } from "@/domain/event";
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

  return {
    id: `saran:${raw.uid}`,
    title: raw.summary.trim(),
    description: raw.description,
    imageUrl: null,
    startAt,
    endAt,
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

/**
 * Interprète un horodatage « mural » dans un fuseau IANA → ISO offset.
 * Sans dépendance externe (approximation via Intl).
 */
export function wallTimeToIso(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZone: string;
}): string | null {
  if (parts.timeZone === "UTC") {
    const iso = new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ),
    ).toISOString();
    return iso.replace(/\.\d{3}Z$/, "Z");
  }

  const utcMillis = wallTimeInZoneToUtcMillis(parts);
  if (utcMillis == null) return null;

  const offsetMinutes = getTimeZoneOffsetMinutes(utcMillis, parts.timeZone);
  if (offsetMinutes == null) return null;

  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offH = String(Math.floor(abs / 60)).padStart(2, "0");
  const offM = String(abs % 60).padStart(2, "0");

  const y = String(parts.year).padStart(4, "0");
  const mo = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  const h = String(parts.hour).padStart(2, "0");
  const mi = String(parts.minute).padStart(2, "0");
  const s = String(parts.second).padStart(2, "0");

  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${offH}:${offM}`;
}

function wallTimeInZoneToUtcMillis(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZone: string;
}): number | null {
  // Guess UTC as if the wall time were UTC, then correct by the zone offset.
  let utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMinutes(utcGuess, parts.timeZone);
    if (offset == null) return null;
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const next = asUtc - offset * 60_000;
    if (next === utcGuess) return next;
    utcGuess = next;
  }

  return utcGuess;
}

function getTimeZoneOffsetMinutes(
  utcMillis: number,
  timeZone: string,
): number | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = dtf.formatToParts(new Date(utcMillis));
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? "NaN");

    const asWall = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    return (asWall - utcMillis) / 60_000;
  } catch {
    return null;
  }
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
