import type { DetourEvent } from "@/domain/events/event";

/**
 * Événement encore affichable / sélectionnable.
 * - avec endAt : encore en cours si endAt > now (même si déjà commencé)
 * - sans endAt : uniquement si startAt > now
 */
export function isEventStillActive(
  event: Pick<DetourEvent, "startAt" | "endAt">,
  now: Date,
): boolean {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return false;

  if (event.endAt) {
    const endMs = Date.parse(event.endAt);
    if (Number.isNaN(endMs)) return false;
    return endMs > nowMs;
  }

  const startMs = Date.parse(event.startAt);
  if (Number.isNaN(startMs)) return false;
  return startMs > nowMs;
}

/** Filtre pur — ne touche ni relevance ni dedup. */
export function filterStillActiveEvents<T extends Pick<DetourEvent, "startAt" | "endAt">>(
  events: T[],
  now: Date,
): T[] {
  return events.filter((event) => isEventStillActive(event, now));
}
