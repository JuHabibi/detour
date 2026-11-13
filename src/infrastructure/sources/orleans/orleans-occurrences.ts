import { parseISO } from "date-fns";
import type { EventOccurrence } from "@/domain/events/event";

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function parseTimestamp(value: unknown): string {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) {
    throw new Error("Orleans timings: expected timestamp with explicit timezone");
  }
  const date = parseISO(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Orleans timings: invalid date");
  }
  return date.toISOString();
}

/**
 * Parse le calendrier complet, sans filtrer à la fenêtre de synchronisation.
 * Un calendrier malformé fait échouer le fetch : ne jamais persister un snapshot
 * partiel qui effacerait des séances valides. null/absent signifie inconnu.
 */
export function parseOrleansOccurrences(
  timings: unknown,
): EventOccurrence[] | undefined {
  if (timings == null) return undefined;
  if (typeof timings !== "string") {
    throw new Error("Orleans timings: expected JSON string");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(timings);
  } catch {
    throw new Error("Orleans timings: invalid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Orleans timings: expected array");
  }

  const occurrences = new Map<string, EventOccurrence>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Orleans timings: invalid occurrence");
    }
    const startAt = parseTimestamp(entry.begin);
    const endAt = parseTimestamp(entry.end);
    if (endAt < startAt) {
      throw new Error("Orleans timings: end precedes start");
    }
    occurrences.set(`${startAt}/${endAt}`, { startAt, endAt, allDay: false });
  }
  return [...occurrences.values()].sort(
    (a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt),
  );
}
