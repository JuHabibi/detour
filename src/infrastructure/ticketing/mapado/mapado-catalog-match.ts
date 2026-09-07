import type { DetourEvent } from "@/domain/events/event";
import type { MapadoCatalogEntry } from "@/infrastructure/ticketing/mapado/mapado-portal-catalog";
import { titlesMatchConservatively } from "@/infrastructure/ticketing/mapado/mapado-title-normalize";

/**
 * Match conservateur : même jour + titre égal / containment.
 * 0 ou >1 candidat → null (unknown).
 */
export function matchMapadoCatalogEntry(
  event: Pick<DetourEvent, "title" | "startAt">,
  catalog: MapadoCatalogEntry[],
): MapadoCatalogEntry | null {
  const eventDay = toParisDayKey(event.startAt);
  if (!eventDay) return null;

  const hits = catalog.filter((entry) => {
    if (entry.day !== eventDay) return false;
    return titlesMatchConservatively(event.title, entry.title);
  });

  if (hits.length !== 1) return null;
  return hits[0]!;
}

export function toParisDayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}
