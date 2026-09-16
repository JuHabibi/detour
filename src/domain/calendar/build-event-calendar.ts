import type { DetourEvent } from "@/domain/events/event";

const PRODID = "-//Detour//Calendar//FR";
const PRODUCT_TZ = "Europe/Paris";

export type BuildEventCalendarOptions = {
  /** Instant de génération (DTSTAMP). Défaut = maintenant. */
  now?: Date;
};

type CalendarYmd = { year: number; month: number; day: number };

/** Chemin public de téléchargement ICS (eventId encodé). */
export function eventCalendarPath(eventId: string): string {
  return `/api/events/${encodeURIComponent(eventId)}/calendar`;
}

/** UID stable — uniquement dérivé de event.id. */
export function eventCalendarUid(eventId: string): string {
  return `${eventId}@detour`;
}

/** Nom de fichier `detour-<slug>.ics`. */
export function eventCalendarFilename(title: string): string {
  const slug = slugifyTitle(title);
  return `detour-${slug}.ics`;
}

/**
 * Génère un calendrier iCalendar (RFC 5545) pour un DetourEvent.
 * Pur — pas de Next / DB. Dates timed en UTC (Z) ; all-day en DATE Europe/Paris.
 */
export function buildEventCalendar(
  event: DetourEvent,
  options?: BuildEventCalendarOptions,
): string {
  const now = options?.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(eventCalendarUid(event.id))}`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.allDay) {
    const start = calendarDateInParis(event.startAt);
    lines.push(`DTSTART;VALUE=DATE:${formatDateValue(start)}`);
    const endExclusive = event.endAt
      ? calendarDateInParis(event.endAt)
      : addCalendarDays(start, 1);
    lines.push(`DTEND;VALUE=DATE:${formatDateValue(endExclusive)}`);
  } else {
    const start = new Date(event.startAt);
    lines.push(`DTSTART:${formatUtcDateTime(start)}`);
    const end = event.endAt
      ? new Date(event.endAt)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    lines.push(`DTEND:${formatUtcDateTime(end)}`);
  }

  const location = formatLocation(event.venue, event.city);
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }

  const description = event.description?.trim();
  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`);
  }

  const url = pickUrl(event);
  if (url) {
    lines.push(`URL:${escapeText(url)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

function pickUrl(event: DetourEvent): string | null {
  const registration = event.registrationUrl?.trim();
  if (registration) return registration;
  const source = event.sourceUrl?.trim();
  return source || null;
}

/** venue + city sans doublon (égalité insensible à la casse / trim). */
export function formatLocation(
  venue: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const v = venue?.trim() || "";
  const c = city?.trim() || "";
  if (!v && !c) return null;
  if (!v) return c;
  if (!c) return v;
  if (v.toLowerCase() === c.toLowerCase()) return v;
  if (v.toLowerCase().includes(c.toLowerCase())) return v;
  return `${v}, ${c}`;
}

export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

/** Folding RFC 5545 — max 75 octets, CRLF + espace. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const budget = first ? 75 : 74; // continuation: leading space counts
    let end = Math.min(offset + budget, bytes.length);
    // Ne pas couper un codepoint UTF-8 au milieu.
    while (end > offset && (bytes[end]! & 0xc0) === 0x80) {
      end -= 1;
    }
    if (end === offset) {
      end = Math.min(offset + budget, bytes.length);
    }
    const chunk = decoder.decode(bytes.subarray(offset, end));
    parts.push(first ? chunk : ` ${chunk}`);
    first = false;
    offset = end;
  }
  return parts.join("\r\n");
}

function formatUtcDateTime(date: Date): string {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return iso.endsWith("Z") ? iso : `${iso}Z`;
}

function formatDateValue(ymd: CalendarYmd): string {
  return `${String(ymd.year).padStart(4, "0")}${String(ymd.month).padStart(2, "0")}${String(ymd.day).padStart(2, "0")}`;
}

/** Date civile Europe/Paris (alignée UI Détour). */
export function calendarDateInParis(iso: string): CalendarYmd {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRODUCT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = formatted.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

export function addCalendarDays(ymd: CalendarYmd, days: number): CalendarYmd {
  const utc = Date.UTC(ymd.year, ymd.month - 1, ymd.day + days);
  const next = new Date(utc);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "event";
}
