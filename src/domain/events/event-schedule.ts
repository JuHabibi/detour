import type { DetourEvent } from "./event";

export type EventDates = Pick<
  DetourEvent,
  "startAt" | "endAt" | "allDay" | "occurrences"
>;
export type EventWindow = {
  from: Date;
  to?: Date | null;
  startInWindow?: boolean;
  now?: Date;
};

/** Fin exclusive ; une séance sans durée est un instant, pas un intervalle. */
export function datesMatchWindow(
  dates: EventDates,
  window: EventWindow,
): boolean {
  const start = Date.parse(dates.startAt);
  const end = dates.endAt ? Date.parse(dates.endAt) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    return false;
  const from = window.from.getTime();
  if (window.to && start > window.to.getTime()) return false;
  if (window.startInWindow && start < from) return false;
  if (!(end > from || (end === start && start >= from))) return false;
  return !window.now || end > window.now.getTime();
}

/** Une seule séance pertinente par événement, avant scoring/affichage. */
export function selectEventInWindow<T extends EventDates>(
  event: T,
  window: EventWindow,
): T | null {
  if (event.occurrences === undefined)
    return datesMatchWindow(event, window) ? event : null;
  const selected = event.occurrences
    .filter((occurrence) => datesMatchWindow(occurrence, window))
    .sort(
      (a, b) =>
        Date.parse(a.startAt) - Date.parse(b.startAt) ||
        Date.parse(a.endAt) - Date.parse(b.endAt),
    )[0];
  return selected ? { ...event, ...selected } : null;
}

/** Détail/favoris : prochaine séance, sinon dernière séance connue (historique). */
export function eventForDisplay<T extends EventDates>(event: T, now: Date): T {
  if (event.occurrences === undefined || event.occurrences.length === 0)
    return event;
  const next = selectEventInWindow(event, { from: now, now });
  if (next) return next;
  const last = [...event.occurrences].sort(
    (a, b) =>
      Date.parse(b.endAt) - Date.parse(a.endAt) ||
      Date.parse(b.startAt) - Date.parse(a.startAt),
  )[0];
  return { ...event, ...last };
}
