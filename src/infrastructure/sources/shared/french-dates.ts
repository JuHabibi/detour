import type { EventOccurrence } from "@/domain/events/event";
import { wallTimeToIso } from "./wall-time";

const FRENCH_MONTHS: Record<string, number> = {
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

export const FRENCH_WEEKDAYS =
  "Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche";

export function frenchMonthNumber(raw: string): number | null {
  const key = raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/û/g, "û");
  return FRENCH_MONTHS[key] ?? FRENCH_MONTHS[key.normalize("NFD").replace(/\p{M}/gu, "")] ?? null;
}

type CivilDate = { year: number; month: number; day: number };

export type ExplicitDateListResult =
  | { kind: "absent" }
  | { kind: "inconsistent" }
  | { kind: "resolved"; occurrences: EventOccurrence[] };

const EXPLICIT_DAY_LIST_RE = new RegExp(
  `\\bles?\\s+(?:(?:${FRENCH_WEEKDAYS})s?\\s+)?` +
    `((?:1er|\\d{1,2})(?:\\s*(?:,|et)\\s*(?:1er|\\d{1,2}))+` +
    `)\\s+(${Object.keys(FRENCH_MONTHS).join("|")})\\b(?:\\s+(\\d{4}))?`,
  "gi",
);

/**
 * Lecture optionnelle d'une liste explicite de jours d'un même mois.
 * Entrées neutres : texte, bornes civiles inclusives et fuseau de la source.
 * L'adaptateur décide si cette lecture est pertinente ; ne remplace jamais
 * automatiquement un calendrier structuré par une interprétation de sa prose.
 * Aucune heure ou récurrence n'est déduite. Les séances sont date-only.
 */
export function resolveExplicitFrenchDateList(params: {
  texts: readonly (string | null | undefined)[];
  sourceStart: CivilDate;
  sourceEnd: CivilDate;
  timeZone: string;
}): ExplicitDateListResult {
  const groups = [...params.texts.filter(Boolean).join("\n").matchAll(EXPLICIT_DAY_LIST_RE)];
  if (groups.length === 0) return { kind: "absent" };
  if (!isValidCivilDate(params.sourceStart) || !isValidCivilDate(params.sourceEnd)) {
    return { kind: "inconsistent" };
  }

  let result: EventOccurrence[] | undefined;
  for (const match of groups) {
    const month = frenchMonthNumber(match[2]!);
    const year = match[3] ? Number(match[3]) : params.sourceStart.year;
    if (!month || (!match[3] && year !== params.sourceEnd.year)) {
      return { kind: "inconsistent" };
    }
    const days = [...new Set(
      match[1]!.match(/1er|\d{1,2}/g)!.map((day) => parseInt(day, 10)),
    )].sort((a, b) => a - b);
    if (
      days.length < 2 ||
      !sameCivilDate({ year, month, day: days[0]! }, params.sourceStart) ||
      !sameCivilDate({ year, month, day: days.at(-1)! }, params.sourceEnd)
    ) return { kind: "inconsistent" };

    const occurrences: EventOccurrence[] = [];
    for (const day of days) {
      if (!isValidCivilDate({ year, month, day })) return { kind: "inconsistent" };
      const next = new Date(Date.UTC(year, month - 1, day + 1));
      const clock = { hour: 0, minute: 0, second: 0, timeZone: params.timeZone };
      const startAt = wallTimeToIso({ year, month, day, ...clock });
      const endAt = wallTimeToIso({
        year: next.getUTCFullYear(), month: next.getUTCMonth() + 1,
        day: next.getUTCDate(), ...clock,
      });
      if (!startAt || !endAt) return { kind: "inconsistent" };
      occurrences.push({ startAt, endAt, allDay: true });
    }
    // Accroche et description ne doivent pas se contredire.
    if (result && JSON.stringify(result) !== JSON.stringify(occurrences)) {
      return { kind: "inconsistent" };
    }
    result = occurrences;
  }
  return { kind: "resolved", occurrences: result! };
}

function sameCivilDate(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function isValidCivilDate(date: CivilDate): boolean {
  const parsed = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return date.year >= 2000 && sameCivilDate(date, {
    year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  });
}

