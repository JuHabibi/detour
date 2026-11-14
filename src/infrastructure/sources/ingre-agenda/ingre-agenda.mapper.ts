import type { DetourEvent, EventOccurrence } from "@/domain/events/event";
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

/** Liste fermée de jours d'un même mois, jamais une récurrence calculée. */
const EXPLICIT_DAY_LIST_RE = new RegExp(
  `\\bles?\\s+(?:(?:${WEEKDAY})s?\\s+)?` +
    `((?:1er|\\d{1,2})(?:\\s*(?:,|et)\\s*(?:1er|\\d{1,2}))+` +
    `)\\s+(${Object.keys(MONTHS).join("|")})\\b(?:\\s+(\\d{4}))?`,
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

  const multiDayTimed =
    !detail.allDay && !isSameCivilDay(bounds.startParts, bounds.endParts);
  const pseudoAllDayCultural =
    multiDayTimed &&
    isIdenticalClockTime(bounds.startParts, bounds.endParts) &&
    hasContinuousCulturalSignal(detail);

  // Période multi-jours horodatée = risque de faux événement continu éditorial.
  // Exception étroite : heures identiques (fenêtre Drupal) + signal expo/festival.
  if (multiDayTimed && !pseudoAllDayCultural) {
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

  const effectiveBounds = pseudoAllDayCultural
    ? toAllDayBounds(bounds.startParts, bounds.endParts)
    : bounds;
  if (!effectiveBounds) {
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

  const allDay = detail.allDay || pseudoAllDayCultural;
  const explicitDates = resolveExplicitAllDayDates(detail, effectiveBounds);
  if (explicitDates === null) {
    return {
      ok: false,
      exclusion: {
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
        reason: "ambiguous_program",
        detail: "explicit_dates_conflict_with_source_range",
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
      startAt: effectiveBounds.startAt,
      endAt: effectiveBounds.endAt,
      ...(allDay ? { allDay: true as const } : {}),
      occurrences: explicitDates ?? [
        {
          startAt: effectiveBounds.startAt,
          endAt: effectiveBounds.endAt ?? effectiveBounds.startAt,
          allDay,
        },
      ],
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
  return (event.occurrences ?? [event]).some((dates) => {
    const start = Date.parse(dates.startAt);
    if (Number.isNaN(start)) return false;

    const end = dates.endAt ? Date.parse(dates.endAt) : Number.NaN;
    const exclusiveEnd = Number.isNaN(end) || end === start ? start + 1 : end;

    return start < to.getTime() && exclusiveEnd > from.getTime();
  });
}

/**
 * undefined : pas de liste explicite ; null : liste incohérente, ne pas publier
 * la plage à sa place. Année omise : celle des bornes, uniquement si non ambiguë.
 * Les heures en prose ne sont pas interprétées. Les bornes source doivent
 * exactement encadrer la liste complète ; aucun jour intermédiaire n'est déduit.
 */
function resolveExplicitAllDayDates(
  detail: IngreAgendaDetail,
  bounds: {
    startAt: string;
    endAt: string | null;
    startParts: WallParts;
    endParts: WallParts;
  },
): EventOccurrence[] | null | undefined {
  // Une expo peut citer des ateliers ponctuels sans cesser d'être continue.
  if (!detail.allDay || hasContinuousCulturalSignal(detail)) return undefined;
  const text = `${detail.teaser ?? ""}\n${detail.bodyText ?? ""}`;
  const groups = [...text.matchAll(EXPLICIT_DAY_LIST_RE)];
  if (groups.length === 0) return undefined;

  let result: EventOccurrence[] | undefined;
  for (const match of groups) {
    const month = monthNumber(match[2]!);
    const year = match[3] ? Number(match[3]) : bounds.startParts.year;
    // endParts est exclusif : le 1er janvier clôt aussi une plage de décembre.
    const lastSourceDay = addCivilDays(bounds.endParts, -1);
    if (!month || (!match[3] && year !== lastSourceDay.year)) return null;
    const days = [...new Set(
      match[1]!.match(/1er|\d{1,2}/g)!.map((day) => parseInt(day, 10)),
    )].sort((a, b) => a - b);
    if (days.length < 2) return null;
    const occurrences: EventOccurrence[] = [];
    for (const day of days) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) return null;
      const parts: WallParts = {
        year, month, day, hour: 0, minute: 0, second: 0,
        timeZone: INGRE_AGENDA_TIMEZONE,
      };
      const dayBounds = toAllDayBounds(parts, parts);
      if (!dayBounds) return null;
      occurrences.push({
        startAt: dayBounds.startAt,
        endAt: dayBounds.endAt,
        allDay: true,
      });
    }
    if (
      Date.parse(occurrences[0]!.startAt) !== Date.parse(bounds.startAt) ||
      Date.parse(occurrences.at(-1)!.endAt) !== Date.parse(bounds.endAt ?? "") ||
      (result && JSON.stringify(result) !== JSON.stringify(occurrences))
    ) return null;
    result = occurrences;
  }
  return result;
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

function isIdenticalClockTime(a: WallParts, b: WallParts): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

/** Signal culturel fort : exposition / expo / festival (titre ou body). */
function hasContinuousCulturalSignal(detail: IngreAgendaDetail): boolean {
  const haystack = `${detail.title}\n${detail.teaser ?? ""}\n${detail.bodyText ?? ""}`;
  return /\b(?:expositions?|expos?|festivals?)\b/i.test(haystack);
}

/** Bornes all-day exclusives (00:00 jour début → 00:00 jour suivant la fin). */
function toAllDayBounds(
  startParts: WallParts,
  endParts: WallParts,
): {
  startAt: string;
  endAt: string;
  startParts: WallParts;
  endParts: WallParts;
} | null {
  const start: WallParts = {
    year: startParts.year,
    month: startParts.month,
    day: startParts.day,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: INGRE_AGENDA_TIMEZONE,
  };
  const startAt = wallTimeToIso(start);
  if (!startAt) return null;

  const next = addCivilDays(
    {
      year: endParts.year,
      month: endParts.month,
      day: endParts.day,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone: INGRE_AGENDA_TIMEZONE,
    },
    1,
  );
  const end: WallParts = {
    ...next,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: INGRE_AGENDA_TIMEZONE,
  };
  const endAt = wallTimeToIso(end);
  if (!endAt) return null;

  return { startAt, endAt, startParts: start, endParts: end };
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
