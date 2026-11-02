import { isEventStillActive } from "@/domain/events/is-event-still-active";
import { absoluteSiteUrl } from "@/config/site";
import type { EventSitemapRow } from "@/infrastructure/db/event.repository";
import { eventPublicPath } from "@/lib/event-public-path";

export type PublicEventSitemapEntry = {
  url: string;
};

/**
 * Filtre temporel (mêmes règles que les fiches) puis URLs canoniques.
 * Entrée = corpus actif déjà chargé (cache) — pas de N+1.
 */
export function listPublicEventSitemapEntries(
  rows: readonly EventSitemapRow[],
  now: Date = new Date(),
): PublicEventSitemapEntry[] {
  const seen = new Set<string>();
  const entries: PublicEventSitemapEntry[] = [];

  for (const row of rows) {
    if (!isEventStillActive(row, now)) continue;
    const url = absoluteSiteUrl(eventPublicPath(row.id));
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ url });
  }

  return entries;
}
