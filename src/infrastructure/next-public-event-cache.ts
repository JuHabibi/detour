import { revalidateTag, unstable_cache } from "next/cache";
import {
  getPublicEventPage,
  type GetPublicEventPageResult,
} from "@/application/events/get-public-event-page";

/** Tag global — invalidé après sync (création / maj / désactivation). */
export const PUBLIC_EVENTS_CACHE_TAG = "public-events";

export const PUBLIC_EVENT_CACHE_REVALIDATE_SECONDS = 60 * 60 * 6;

export function publicEventCacheTag(eventId: string): string {
  return `public-event:${eventId}`;
}

/**
 * Fiche publique via Data Cache. Ne cache que le résultat métier ;
 * une exception DB remonte sans être mémorisée comme 404.
 */
export async function getCachedPublicEventPage(
  eventId: string,
): Promise<GetPublicEventPageResult> {
  const cached = unstable_cache(
    async () => getPublicEventPage(eventId),
    ["detour-public-event", eventId],
    {
      tags: [PUBLIC_EVENTS_CACHE_TAG, publicEventCacheTag(eventId)],
      revalidate: PUBLIC_EVENT_CACHE_REVALIDATE_SECONDS,
    },
  );
  return cached();
}

export function invalidatePublicEventsCache(): void {
  revalidateTag(PUBLIC_EVENTS_CACHE_TAG, "max");
}
