import { parisCalendarYear } from "@/domain/time/paris-calendar-year";
import { toParisDateKey } from "@/domain/time/when-filter";

export type WeekendCardWhenEvent = {
  startAt?: string;
  endAt?: string | null;
  allDay?: boolean;
  date?: string;
  dateLabel?: string;
  time?: string;
};

export type WeekendCardWhenBounds = {
  saturdayKey: string;
  sundayKey: string;
};

/**
 * Label temporel pour une carte « Ce week-end ».
 *
 * - Occurrence ponctuelle dont le début tombe un jour du week-end : date · heure réelle.
 * - Multi-jours / début avant le samedi / all-day : uniquement les jours civils Paris
 *   qui intersectent le week-end (fin all-day exclusive → inclusive), sans inventer d’horaire.
 */
export function formatWeekendCardWhen(
  event: WeekendCardWhenEvent,
  weekend: WeekendCardWhenBounds,
): string {
  if (!event.startAt) {
    return event.dateLabel?.trim() || event.date || "";
  }

  const startKey = toParisDateKey(new Date(event.startAt));
  const endKey = resolveInclusiveEndKey(event) ?? startKey;
  const overlapFrom =
    startKey > weekend.saturdayKey ? startKey : weekend.saturdayKey;
  const overlapTo = endKey < weekend.sundayKey ? endKey : weekend.sundayKey;

  if (overlapFrom > overlapTo) {
    return event.dateLabel?.trim() || formatCompactParisDay(startKey);
  }

  if (overlapFrom === overlapTo) {
    const punctualOnThatDay =
      !event.allDay &&
      startKey === overlapFrom &&
      endKey === overlapFrom &&
      Boolean(event.time);

    if (punctualOnThatDay) {
      return `${formatCompactParisDay(overlapFrom)} · ${event.time}`;
    }
    return formatCompactParisDay(overlapFrom);
  }

  return `${formatCompactParisDay(overlapFrom)} – ${formatCompactParisDay(overlapTo)}`;
}

function resolveInclusiveEndKey(event: WeekendCardWhenEvent): string | null {
  if (!event.endAt) return null;
  const endMs = Date.parse(event.endAt);
  if (Number.isNaN(endMs)) return null;

  if (event.allDay) {
    // RFC 5545 : endAt exclusif → dernier jour civil inclus.
    return toParisDateKey(new Date(endMs - 1));
  }
  return toParisDateKey(new Date(endMs));
}

function formatCompactParisDay(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  const eventYear = dateKey.slice(0, 4);
  const showYear =
    Boolean(eventYear) && eventYear !== parisCalendarYear(new Date());

  const label = new Intl.DateTimeFormat("fr-FR", {
    ...(showYear
      ? { day: "numeric" as const, month: "short" as const, year: "numeric" as const }
      : {
          weekday: "short" as const,
          day: "numeric" as const,
          month: "short" as const,
        }),
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}
