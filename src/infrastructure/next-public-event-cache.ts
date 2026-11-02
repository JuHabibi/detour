import { revalidateTag, unstable_cache } from "next/cache";
import {
  applyPublicEventEndedStatus,
  getPublicEventSnapshot,
  type GetPublicEventPageResult,
} from "@/application/events/get-public-event-page";
import {
  listActiveEventsForSitemap,
  type EventSitemapRow,
} from "@/infrastructure/db/event.repository";

/** Tag global — invalidé après sync (création / maj / désactivation). */
export const PUBLIC_EVENTS_CACHE_TAG = "public-events";

export const PUBLIC_EVENT_CACHE_REVALIDATE_SECONDS = 60 * 60 * 6;

export function publicEventCacheTag(eventId: string): string {
  return `public-event:${eventId}`;
}

/**
 * Snapshot PG via Data Cache (6h / invalidation sync).
 * `isEnded` est calculé **après** lecture du cache, à l’horloge de la requête.
 */
export async function getCachedPublicEventPage(
  eventId: string,
  now: Date = new Date(),
): Promise<GetPublicEventPageResult> {
  const cachedSnapshot = unstable_cache(
    async () => getPublicEventSnapshot(eventId),
    ["detour-public-event", eventId],
    {
      tags: [PUBLIC_EVENTS_CACHE_TAG, publicEventCacheTag(eventId)],
      revalidate: PUBLIC_EVENT_CACHE_REVALIDATE_SECONDS,
    },
  );

  const snapshot = await cachedSnapshot();
  return applyPublicEventEndedStatus(snapshot, now);
}

/**
 * Liste active sitemap via Data Cache (même tag / TTL que les fiches).
 * Le filtrage temporel reste **hors** cache, à chaque requête sitemap.
 */
export async function getCachedActiveEventSitemapRows(): Promise<
  EventSitemapRow[]
> {
  const cached = unstable_cache(
    async () => listActiveEventsForSitemap(),
    ["detour-public-event-sitemap-v1"],
    {
      tags: [PUBLIC_EVENTS_CACHE_TAG],
      revalidate: PUBLIC_EVENT_CACHE_REVALIDATE_SECONDS,
    },
  );
  return cached();
}

export function invalidatePublicEventsCache(): void {
  revalidateTag(PUBLIC_EVENTS_CACHE_TAG, "max");
}
