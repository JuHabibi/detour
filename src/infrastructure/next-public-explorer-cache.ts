import { revalidateTag, unstable_cache } from "next/cache";
import { getPublicExplorerInitialPage } from "@/application/explorer/get-public-explorer-initial-page";
import type { PublicExplorerInitialPage } from "@/application/explorer/get-public-explorer-initial-page";
import { PUBLIC_TERRITORY_SLUG } from "@/config/public-territory";
import { getDateRangeForWhenFilter, toParisDateKey } from "@/domain/time/when-filter";
import { isEventStillActive } from "@/domain/events/is-event-still-active";

/**
 * Cache Explorer public — même territoire, TTL court pour le snapshot temporel.
 * Tag distinct : invalidation post-sync sans coupler le snapshot Radar.
 * N’importe pas `next-public-home-cache` (évite d’initialiser Radar / IA).
 */
export const PUBLIC_EXPLORER_CACHE_TAG = `public-explorer:${PUBLIC_TERRITORY_SLUG}`;

export const PUBLIC_EXPLORER_CACHE_REVALIDATE_SECONDS = 60;

export async function getCachedPublicExplorerInitialPage(): Promise<PublicExplorerInitialPage> {
  const now = new Date();
  const saturdayKey = toParisDateKey(getDateRangeForWhenFilter("weekend", now).from);
  const cached = unstable_cache(
    async () => getPublicExplorerInitialPage(),
    [
      "detour-public-explorer",
      PUBLIC_TERRITORY_SLUG,
      "initial-weekend-12-occurrences-v2",
      saturdayKey,
    ],
    {
      tags: [PUBLIC_EXPLORER_CACHE_TAG],
      revalidate: PUBLIC_EXPLORER_CACHE_REVALIDATE_SECONDS,
    },
  );

  const page = await cached();
  // SWR peut servir un ancien snapshot : ne pas déplacer ses cartes seules,
  // ce qui désalignerait le count et le curseur. Relire alors la page entière.
  const expired = page.events.some((item) => item.startAt && !isEventStillActive({
    startAt: item.startAt, endAt: item.endAt ?? null,
  }, now));
  return expired ? getPublicExplorerInitialPage() : page;
}

export function invalidatePublicExplorerCache(): void {
  revalidateTag(PUBLIC_EXPLORER_CACHE_TAG, "max");
}
