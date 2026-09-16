import type { DetourEvent } from "@/domain/events/event";
import { wallTimeToIso } from "@/infrastructure/sources/saran/saran-ical.mapper";
import type { OrmesDetail, OrmesExclusion } from "./ormes.types";

export const ORMES_SOURCE_NAME = "Ville d'Ormes";
export const ORMES_CITY = "Ormes";
export const ORMES_TIMEZONE = "Europe/Paris";

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

const WEEKDAY =
  "Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche";

const BODY_DATE_RE = new RegExp(
  `(?:(?:${WEEKDAY})\\s+|(?:le\\s+)?)(1er|\\d{1,2})\\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)(?:\\s+(\\d{4}))?`,
  "gi",
);

export type OrmesMapResult =
  | { ok: true; event: DetourEvent }
  | { ok: false; exclusion: OrmesExclusion };

/**
 * Mappe une fiche Ormes → DetourEvent, ou exclusion fail-closed.
 */
export function mapOrmesDetailToDetourEvent(detail: OrmesDetail): OrmesMapResult {
  if (!detail.eventId.trim()) {
    return {
      ok: false,
      exclusion: {
        id: null,
        slug: detail.slug,
        title: detail.title,
        reason: "missing_id",
      },
    };
  }

  if (!detail.title.trim()) {
    return {
      ok: false,
      exclusion: {
        id: detail.eventId,
        slug: detail.slug,
        title: detail.title,
        reason: "missing_title",
      },
    };
  }

  if (/\bCOMPLET\b/i.test(detail.title)) {
    return {
      ok: false,
      exclusion: {
        id: detail.eventId,
        slug: detail.slug,
        title: detail.title,
        reason: "complete",
        detail: "title_contains_COMPLET",
      },
    };
  }

  const ambiguous = detectAmbiguousProgram(detail);
  if (ambiguous) {
    return {
      ok: false,
      exclusion: {
        id: detail.eventId,
        slug: detail.slug,
        title: detail.title,
        reason: "ambiguous_program",
        detail: ambiguous,
      },
    };
  }

  const bounds = resolveOrmesBounds(detail);
  if (!bounds) {
    return {
      ok: false,
      exclusion: {
        id: detail.eventId,
        slug: detail.slug,
        title: detail.title,
        reason: "unparseable_date",
        detail: detail.dateRaw ?? undefined,
      },
    };
  }

  // Plage multi-jours avec horaires = continuum ambigu (expo / salon).
  if (
    !bounds.allDay &&
    !isSameCivilDay(bounds.startParts, bounds.endParts)
  ) {
    return {
      ok: false,
      exclusion: {
        id: detail.eventId,
        slug: detail.slug,
        title: detail.title,
        reason: "ambiguous_program",
        detail: "multi_day_timed_range",
      },
    };
  }

  return {
    ok: true,
    event: {
      id: `ormes:${detail.eventId}`,
      title: detail.title.trim(),
      description: detail.bodyText,
      imageUrl: detail.imageUrl,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
      ...(bounds.allDay ? { allDay: true as const } : {}),
      venue: detail.venue,
      city: ORMES_CITY,
      latitude: detail.latitude,
      longitude: detail.longitude,
      category: detail.categories[0] ?? null,
      genre: null,
      conditions: detail.conditions,
      source: ORMES_SOURCE_NAME,
      sourceUrl: detail.canonicalUrl,
      registrationUrl: detail.registrationUrl,
    },
  };
}

export function ormesEventIntersectsWindow(
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

export function detectAmbiguousProgram(detail: OrmesDetail): string | null {
  const body = detail.bodyText?.trim() ?? "";
  if (!body) return null;

  const keys = new Set<string>();
  BODY_DATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BODY_DATE_RE.exec(body)) !== null) {
    const dayRaw = match[1]!;
    const day =
      dayRaw.toLowerCase() === "1er" ? 1 : Number.parseInt(dayRaw, 10);
    const month = monthNumber(match[2]!);
    if (!month || day < 1 || day > 31) continue;
    const year = match[3] ? Number.parseInt(match[3], 10) : null;
    keys.add(`${year ?? "*"}-${month}-${day}`);
  }

  // Une seule date murale structurée + une autre distincte dans le body.
  if (detail.dateStartLabel) {
    const structured = parseFrenchDate(detail.dateStartLabel);
    if (structured) {
      const structuredKey = `${structured.year}-${structured.month}-${structured.day}`;
      const foreign = [...keys].filter((key) => {
        if (key === structuredKey) return false;
        // Même jour sans année (`*-m-d`) = pas conflictuel.
        if (key === `*-${structured.month}-${structured.day}`) return false;
        return true;
      });
      if (foreign.length > 0) {
        return `body_distinct_dates:${[structuredKey, ...foreign].join(",")}`;
      }
    }
  } else if (keys.size >= 2) {
    return `body_distinct_dates:${[...keys].sort().join(",")}`;
  }

  return null;
}

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZone: string;
};

function resolveOrmesBounds(detail: OrmesDetail): {
  startAt: string;
  endAt: string | null;
  startParts: WallParts;
  endParts: WallParts;
  allDay: boolean;
} | null {
  if (!detail.dateStartLabel) return null;

  const startDay = parseFrenchDate(detail.dateStartLabel);
  if (!startDay) return null;

  const endDay = detail.dateEndLabel
    ? parseFrenchDate(detail.dateEndLabel)
    : startDay;
  if (!endDay) return null;

  const hasTimes = detail.startTime != null;

  if (hasTimes) {
    const [sh, sm] = parseHm(detail.startTime!);
    if (sh == null || sm == null) return null;

    const startParts: WallParts = {
      ...startDay,
      hour: sh,
      minute: sm,
      second: 0,
      timeZone: ORMES_TIMEZONE,
    };
    const startAt = wallTimeToIso(startParts);
    if (!startAt) return null;

    let endParts = startParts;
    let endAt: string | null = null;
    if (detail.endTime) {
      const [eh, em] = parseHm(detail.endTime);
      if (eh == null || em == null) return null;
      endParts = {
        ...endDay,
        hour: eh,
        minute: em,
        second: 0,
        timeZone: ORMES_TIMEZONE,
      };
      endAt = wallTimeToIso(endParts);
      if (!endAt) return null;
    }

    return { startAt, endAt, startParts, endParts, allDay: false };
  }

  // Sans horaires : jour entier (end exclusive = lendemain de la fin).
  const startParts: WallParts = {
    ...startDay,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: ORMES_TIMEZONE,
  };
  const startAt = wallTimeToIso(startParts);
  if (!startAt) return null;

  const next = addCivilDays(endDay, 1);
  const endParts: WallParts = {
    ...next,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: ORMES_TIMEZONE,
  };
  const endAt = wallTimeToIso(endParts);
  if (!endAt) return null;

  return { startAt, endAt, startParts, endParts, allDay: true };
}

function parseFrenchDate(
  label: string,
): { year: number; month: number; day: number } | null {
  const match = label
    .trim()
    .match(
      /^(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(\d{4})$/i,
    );
  if (!match) return null;
  const day = Number.parseInt(match[1]!, 10);
  const month = monthNumber(match[2]!);
  const year = Number.parseInt(match[3]!, 10);
  if (!month || day < 1 || day > 31 || year < 2000) return null;
  return { year, month, day };
}

function parseHm(value: string): [number | null, number | null] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return [null, null];
  const hour = Number.parseInt(match[1]!, 10);
  const minute = Number.parseInt(match[2]!, 10);
  if (hour > 23 || minute > 59) return [null, null];
  return [hour, minute];
}

function monthNumber(raw: string): number | null {
  const key = raw.normalize("NFC").toLowerCase();
  return (
    MONTHS[key] ??
    MONTHS[key.normalize("NFD").replace(/\p{M}/gu, "")] ??
    null
  );
}

function isSameCivilDay(a: WallParts, b: WallParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function addCivilDays(
  day: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const utc = Date.UTC(day.year, day.month - 1, day.day + days);
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}
