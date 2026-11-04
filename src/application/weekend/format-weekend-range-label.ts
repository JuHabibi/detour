import { toParisDateKey } from "@/domain/time/when-filter";

/**
 * Libellé civil Europe/Paris du week-end (samedi–dimanche).
 * Ex. « samedi 7 et dimanche 8 novembre 2026 ».
 */
export function formatWeekendRangeLabel(from: Date, to: Date): string {
  const fromKey = toParisDateKey(from);
  const toKey = toParisDateKey(to);
  const fromParts = parseParisKey(fromKey);
  const toParts = parseParisKey(toKey);
  if (!fromParts || !toParts) {
    return `${fromKey} – ${toKey}`;
  }

  const saturday = formatParisWeekdayDay(fromParts, { includeMonth: false, includeYear: false });
  const sameMonth = fromParts.month === toParts.month && fromParts.year === toParts.year;
  const sameYear = fromParts.year === toParts.year;

  if (sameMonth) {
    const sundayDay = formatParisDayMonthYear(toParts, {
      includeWeekday: true,
      includeMonth: true,
      includeYear: true,
    });
    return `${saturday} et ${sundayDay}`;
  }

  const saturdayFull = formatParisWeekdayDay(fromParts, {
    includeMonth: true,
    includeYear: !sameYear,
  });
  const sundayFull = formatParisDayMonthYear(toParts, {
    includeWeekday: true,
    includeMonth: true,
    includeYear: true,
  });
  return `${saturdayFull} et ${sundayFull}`;
}

type ParisYmd = { year: number; month: number; day: number };

function parseParisKey(key: string): ParisYmd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatParisWeekdayDay(
  parts: ParisYmd,
  options: { includeMonth: boolean; includeYear: boolean },
): string {
  return formatParisDayMonthYear(parts, {
    includeWeekday: true,
    includeMonth: options.includeMonth,
    includeYear: options.includeYear,
  });
}

function formatParisDayMonthYear(
  parts: ParisYmd,
  options: {
    includeWeekday: boolean;
    includeMonth: boolean;
    includeYear: boolean;
  },
): string {
  // Midi UTC sur la clé civile — même ancrage que les labels cartes.
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0),
  );
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    ...(options.includeWeekday ? { weekday: "long" as const } : {}),
    day: "numeric",
    ...(options.includeMonth ? { month: "long" as const } : {}),
    ...(options.includeYear ? { year: "numeric" as const } : {}),
  }).format(date);
  return label;
}
