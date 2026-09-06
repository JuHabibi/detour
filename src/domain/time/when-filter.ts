export type WhenFilter =
  | "today"
  | "tomorrow"
  | "weekend"
  | "next-week"
  | "this-month"
  | "next-month"
  | "upcoming";

export type DateRange = {
  from: Date;
  /** `null` = pas de borne haute. */
  to: Date | null;
};

const PARIS_TIME_ZONE = "Europe/Paris";

type ParisCivil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = dimanche … 6 = samedi (comme Date#getDay). */
  weekday: number;
};

/**
 * Plage temporelle pour un filtre `when`, en jours civils Europe/Paris.
 */
export function getDateRangeForWhenFilter(
  filter: WhenFilter,
  now: Date,
): DateRange {
  const paris = getParisCivil(now);

  switch (filter) {
    case "today":
      return {
        from: startOfParisDay(paris.year, paris.month, paris.day),
        to: endOfParisDay(paris.year, paris.month, paris.day),
      };

    case "tomorrow": {
      const tomorrow = addParisDays(paris, 1);
      return {
        from: startOfParisDay(tomorrow.year, tomorrow.month, tomorrow.day),
        to: endOfParisDay(tomorrow.year, tomorrow.month, tomorrow.day),
      };
    }

    case "weekend": {
      const saturday = parisWeekendSaturday(paris);
      const sunday = addParisDays(saturday, 1);
      return {
        from: startOfParisDay(saturday.year, saturday.month, saturday.day),
        to: endOfParisDay(sunday.year, sunday.month, sunday.day),
      };
    }

    case "next-week": {
      const monday = parisNextWeekMonday(paris);
      const sunday = addParisDays(monday, 6);
      return {
        from: startOfParisDay(monday.year, monday.month, monday.day),
        to: endOfParisDay(sunday.year, sunday.month, sunday.day),
      };
    }

    case "this-month": {
      const lastDay = daysInParisMonth(paris.year, paris.month);
      return {
        from: startOfParisDay(paris.year, paris.month, paris.day),
        to: endOfParisDay(paris.year, paris.month, lastDay),
      };
    }

    case "next-month": {
      const next =
        paris.month === 12
          ? { year: paris.year + 1, month: 1 }
          : { year: paris.year, month: paris.month + 1 };
      const lastDay = daysInParisMonth(next.year, next.month);
      return {
        from: startOfParisDay(next.year, next.month, 1),
        to: endOfParisDay(next.year, next.month, lastDay),
      };
    }

    case "upcoming":
      return {
        from: now,
        to: null,
      };
  }
}

export function isDateInRange(date: Date, range: DateRange): boolean {
  const time = date.getTime();
  if (time < range.from.getTime()) return false;
  if (range.to != null && time > range.to.getTime()) return false;
  return true;
}

/**
 * Un événement matche si son intervalle [start, end] intersecte la période.
 * Si endAt est absent : end = start.
 * Pour `upcoming` (pas de borne haute) : l’événement n’est pas encore terminé.
 */
export function isEventInWhenFilter(
  eventStartAt: string | Date,
  eventEndAt: string | Date | null | undefined,
  filter: WhenFilter,
  now: Date,
): boolean {
  const eventStart = toValidDate(eventStartAt);
  if (!eventStart) return false;

  const eventEnd =
    eventEndAt == null || eventEndAt === ""
      ? eventStart
      : toValidDate(eventEndAt) ?? eventStart;

  const range = getDateRangeForWhenFilter(filter, now);

  if (range.to == null) {
    // À venir : encore actif maintenant.
    return eventEnd.getTime() >= now.getTime();
  }

  return (
    eventStart.getTime() <= range.to.getTime() &&
    eventEnd.getTime() >= range.from.getTime()
  );
}

function toValidDate(value: string | Date): Date | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parisWeekendSaturday(paris: ParisCivil): {
  year: number;
  month: number;
  day: number;
} {
  // Samedi/dimanche en cours, sinon prochain samedi.
  if (paris.weekday === 6) {
    return { year: paris.year, month: paris.month, day: paris.day };
  }
  if (paris.weekday === 0) {
    return addParisDays(paris, -1);
  }
  return addParisDays(paris, 6 - paris.weekday);
}

function parisNextWeekMonday(paris: ParisCivil): {
  year: number;
  month: number;
  day: number;
} {
  // Lundi prochain (jamais le lundi en cours).
  const daysUntilNextMonday = paris.weekday === 1 ? 7 : (8 - paris.weekday) % 7 || 7;
  return addParisDays(paris, daysUntilNextMonday);
}

function startOfParisDay(year: number, month: number, day: number): Date {
  return fromParisCivil(year, month, day, 0, 0, 0, 0);
}

function endOfParisDay(year: number, month: number, day: number): Date {
  return fromParisCivil(year, month, day, 23, 59, 59, 999);
}

function daysInParisMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addParisDays(
  paris: Pick<ParisCivil, "year" | "month" | "day">,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const utc = Date.UTC(paris.year, paris.month - 1, paris.day + deltaDays);
  const date = new Date(utc);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * Instant UTC correspondant à une date/heure civile à Paris.
 * Ajuste l’offset (CET/CEST) par itération courte.
 */
function fromParisCivil(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  for (let i = 0; i < 3; i += 1) {
    const shown = getParisCivil(new Date(utcMillis));
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
      0,
    );
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    utcMillis += targetAsUtc - shownAsUtc;
  }

  const base = new Date(utcMillis);
  base.setUTCMilliseconds(millisecond);
  return base;
}

function getParisCivil(date: Date): ParisCivil {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const weekdayLabel = read("weekday");
  const weekdayByLabel: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    second: Number(read("second")),
    weekday: weekdayByLabel[weekdayLabel] ?? 0,
  };
}
