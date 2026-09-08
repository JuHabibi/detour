import type { DetourEvent } from "@/domain/events/event";
import { wallTimeToIso } from "@/infrastructure/sources/saran/saran-ical.mapper";
import type {
  IngreAgendaDetail,
  IngreAgendaExclusion,
} from "./ingre-agenda.types";

export const INGRE_AGENDA_SOURCE_NAME = "Ville d'Ingré";
export const INGRE_AGENDA_CITY = "Ingré";
export const INGRE_AGENDA_TIMEZONE = "Europe/Paris";

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

/** Date murale française optionnellement horodatée. */
const FR_DATE_RE = new RegExp(
  `(?:(?:${WEEKDAY})\\s+)?(\\d{1,2})\\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\\s+(\\d{4})(?:\\s+(\\d{1,2}):(\\d{2}))?`,
  "i",
);

/** Mentions de rendez-vous datés dans le corps (année optionnelle). */
const BODY_DATE_RE = new RegExp(
  `(?:(?:${WEEKDAY})\\s+|(?:le\\s+)?)(1er|\\d{1,2})\\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)(?:\\s+(\\d{4}))?`,
  "gi",
);

/**
 * Signaux d’une période administrative / promo asso, pas d’un événement continu.
 * Basés sur le contenu (titre/body), pas sur la durée seule.
 */
const ADMINISTRATIVE_PERIOD_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "title_appel_a", re: /^appel à(?:\s|$)/i },
  { id: "body_nous_recherchons", re: /\bnous recherchons\b/i },
  { id: "body_propose_des_cours", re: /\bpropose des cours\b/i },
  {
    id: "body_inscriptions_period",
    re: /\binscriptions?\s+(ouvertes?|en cours|du|jusqu)/i,
  },
  {
    id: "body_rentree_promo_forum",
    re: /\b(?:faites le plein|dès le\b).{0,120}\bforum des associations\b/i,
  },
];

export type IngreAgendaMapResult =
  | { ok: true; event: DetourEvent }
  | { ok: false; exclusion: IngreAgendaExclusion };

/**
 * Mappe une fiche Ingré vers DetourEvent, ou exclusion diagnostiquée.
 * N’invente ni heure, ni durée, ni lieu structuré.
 */
export function mapIngreAgendaDetailToDetourEvent(
  detail: IngreAgendaDetail,
): IngreAgendaMapResult {
  if (!detail.nid) {
    return {
      ok: false,
      exclusion: {
        nid: null,
        path: detail.path,
        title: detail.title,
        reason: "missing_nid",
      },
    };
  }

  if (!detail.title.trim()) {
    return {
      ok: false,
      exclusion: {
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
        reason: "missing_title",
      },
    };
  }

  const ambiguous = detectAmbiguousProgram({
    title: detail.title,
    bodyText: detail.bodyText,
  });
  if (ambiguous) {
    return {
      ok: false,
      exclusion: {
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
        reason: "ambiguous_program",
        detail: ambiguous,
      },
    };
  }

  const bounds = resolveEventBounds(detail);
  if (!bounds) {
    return {
      ok: false,
      exclusion: {
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
        reason: "unparseable_date",
        detail: detail.dateRaw ?? undefined,
      },
    };
  }

  // Période multi-jours horodatée = risque de faux événement continu éditorial.
  if (
    !detail.allDay &&
    !isSameCivilDay(bounds.startParts, bounds.endParts)
  ) {
    return {
      ok: false,
      exclusion: {
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
        reason: "ambiguous_program",
        detail: "multi_day_timed_range",
      },
    };
  }

  return {
    ok: true,
    event: {
      id: `ingre-agenda:${detail.nid}`,
      title: detail.title.trim(),
      description: detail.teaser ?? detail.bodyText,
      imageUrl: detail.imageUrl,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
      ...(detail.allDay ? { allDay: true as const } : {}),
      venue: null,
      city: INGRE_AGENDA_CITY,
      latitude: null,
      longitude: null,
      category: detail.thematiques[0] ?? null,
      genre: null,
      conditions: buildConditions(detail),
      source: INGRE_AGENDA_SOURCE_NAME,
      sourceUrl: detail.canonicalUrl,
      registrationUrl: null,
    },
  };
}

export function ingreAgendaEventIntersectsWindow(
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

/**
 * Programme multi-rdv / période administrative → exclusion diagnostiquée.
 * Pas de règle basée uniquement sur la durée de la plage.
 */
export function detectAmbiguousProgram(input: {
  title?: string | null;
  bodyText: string | null;
}): string | null {
  const title = input.title?.trim() ?? "";
  const bodyText = input.bodyText?.trim() ?? "";

  for (const pattern of ADMINISTRATIVE_PERIOD_PATTERNS) {
    const haystack = pattern.id.startsWith("title_") ? title : bodyText;
    if (haystack && pattern.re.test(haystack)) {
      return `administrative_period:${pattern.id}`;
    }
  }

  if (!bodyText) return null;

  const keys = new Set<string>();
  BODY_DATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BODY_DATE_RE.exec(bodyText)) !== null) {
    const dayRaw = match[1]!;
    const day = dayRaw.toLowerCase() === "1er" ? 1 : Number.parseInt(dayRaw, 10);
    const month = monthNumber(match[2]!);
    if (!month || day < 1 || day > 31) continue;
    const year = match[3] ? Number.parseInt(match[3], 10) : null;
    keys.add(`${year ?? "*"}-${month}-${day}`);
  }

  if (keys.size >= 2) {
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

function resolveEventBounds(detail: IngreAgendaDetail): {
  startAt: string;
  endAt: string | null;
  startParts: WallParts;
  endParts: WallParts;
} | null {
  if (!detail.dateStartLabel) return null;

  if (detail.singleDayStartTime) {
    const day = parseFrenchDateLabel(detail.dateStartLabel, {
      requireTime: false,
    });
    if (!day) return null;
    const [sh, sm] = parseHm(detail.singleDayStartTime);
    if (sh == null || sm == null) return null;

    const startParts: WallParts = {
      ...day,
      hour: sh,
      minute: sm,
      second: 0,
      timeZone: INGRE_AGENDA_TIMEZONE,
    };
    const startAt = wallTimeToIso(startParts);
    if (!startAt) return null;

    let endAt: string | null = null;
    let endParts = startParts;
    if (detail.singleDayEndTime) {
      const [eh, em] = parseHm(detail.singleDayEndTime);
      if (eh == null || em == null) return null;
      endParts = {
        ...day,
        hour: eh,
        minute: em,
        second: 0,
        timeZone: INGRE_AGENDA_TIMEZONE,
      };
      endAt = wallTimeToIso(endParts);
      if (!endAt) return null;
    }

    return { startAt, endAt, startParts, endParts };
  }

  // Jour entier sur date-display-single (sans horaires imbriqués).
  if (detail.allDay) {
    const startParsed = parseFrenchDateLabel(detail.dateStartLabel, {
      requireTime: false,
      defaultTime: { hour: 0, minute: 0 },
    });
    if (!startParsed) return null;

    const endLabel = detail.dateEndLabel ?? detail.dateStartLabel;
    const endParsed = parseFrenchDateLabel(endLabel, {
      requireTime: false,
      defaultTime: { hour: 0, minute: 0 },
    });
    if (!endParsed) return null;

    const startParts: WallParts = {
      ...startParsed,
      second: 0,
      timeZone: INGRE_AGENDA_TIMEZONE,
    };
    const startAt = wallTimeToIso(startParts);
    if (!startAt) return null;

    const next = addCivilDays(
      {
        ...endParsed,
        second: 0,
        timeZone: INGRE_AGENDA_TIMEZONE,
      },
      1,
    );
    const endParts: WallParts = {
      ...next,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone: INGRE_AGENDA_TIMEZONE,
    };
    const endAt = wallTimeToIso(endParts);
    if (!endAt) return null;

    return { startAt, endAt, startParts, endParts };
  }

  const startParsed = parseFrenchDateLabel(detail.dateStartLabel, {
    requireTime: true,
    defaultTime: null,
  });
  if (!startParsed) return null;

  const startParts: WallParts = {
    ...startParsed,
    second: 0,
    timeZone: INGRE_AGENDA_TIMEZONE,
  };
  const startAt = wallTimeToIso(startParts);
  if (!startAt) return null;

  const endLabel = detail.dateEndLabel ?? detail.dateStartLabel;
  const endParsed = parseFrenchDateLabel(endLabel, {
    requireTime: true,
    defaultTime: null,
  });
  if (!endParsed) return null;

  const endParts: WallParts = {
    ...endParsed,
    second: 0,
    timeZone: INGRE_AGENDA_TIMEZONE,
  };

  const endAt = wallTimeToIso(endParts);
  if (!endAt) return null;

  return { startAt, endAt, startParts, endParts };
}

function parseFrenchDateLabel(
  label: string,
  options: {
    requireTime: boolean;
    defaultTime?: { hour: number; minute: number } | null;
  },
): Omit<WallParts, "timeZone"> | null {
  const cleaned = label.replace(/\(\s*Jour entier\s*\)/gi, "").trim();
  const match = FR_DATE_RE.exec(cleaned);
  if (!match) return null;

  const day = Number.parseInt(match[1]!, 10);
  const month = monthNumber(match[2]!);
  const year = Number.parseInt(match[3]!, 10);
  if (!month || day < 1 || day > 31 || year < 2000) return null;

  const hasTime = match[4] != null && match[5] != null;
  if (options.requireTime && !hasTime && !options.defaultTime) {
    return null;
  }

  let hour = 0;
  let minute = 0;
  if (hasTime) {
    hour = Number.parseInt(match[4]!, 10);
    minute = Number.parseInt(match[5]!, 10);
  } else if (options.defaultTime) {
    hour = options.defaultTime.hour;
    minute = options.defaultTime.minute;
  }

  if (hour > 23 || minute > 59) return null;

  return { year, month, day, hour, minute, second: 0 };
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
  const key = raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/û/g, "û");
  return MONTHS[key] ?? MONTHS[key.normalize("NFD").replace(/\p{M}/gu, "")] ?? null;
}

function isSameCivilDay(a: WallParts, b: WallParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function addCivilDays(
  parts: WallParts,
  days: number,
): Pick<WallParts, "year" | "month" | "day"> {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function buildConditions(detail: IngreAgendaDetail): string | null {
  const parts: string[] = [];
  if (detail.gratuit) {
    const g = detail.gratuit.trim().toLowerCase();
    if (g === "oui" || g === "yes") parts.push("Gratuit");
    else if (g === "non" || g === "no") parts.push("Payant");
    else parts.push(detail.gratuit.trim());
  }
  if (detail.publicLabel) parts.push(detail.publicLabel.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}
