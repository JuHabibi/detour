import { revalidateTag, unstable_cache } from "next/cache";
import { getPublicExplorerInitialPage } from "@/application/explorer/get-public-explorer-initial-page";
import type { PublicExplorerInitialPage } from "@/application/explorer/get-public-explorer-initial-page";
import { PUBLIC_HOME_TERRITORY_SLUG } from "@/infrastructure/next-public-home-cache";

/**
 * Cache Explorer public — même territoire et TTL que la Home.
 * Tag distinct : invalidation post-sync sans coupler le snapshot Radar.
 */
export const PUBLIC_EXPLORER_CACHE_TAG = `public-explorer:${PUBLIC_HOME_TERRITORY_SLUG}`;

export const PUBLIC_EXPLORER_CACHE_REVALIDATE_SECONDS = 60 * 60 * 6;

export async function getCachedPublicExplorerInitialPage(): Promise<PublicExplorerInitialPage> {
  const cached = unstable_cache(
    async () => getPublicExplorerInitialPage(),
    [
      "detour-public-explorer",
      PUBLIC_HOME_TERRITORY_SLUG,
      "initial-weekend-12-v1",
    ],
    {
      tags: [PUBLIC_EXPLORER_CACHE_TAG],
      revalidate: PUBLIC_EXPLORER_CACHE_REVALIDATE_SECONDS,
    },
  );

  return cached();
}

export function invalidatePublicExplorerCache(): void {
  revalidateTag(PUBLIC_EXPLORER_CACHE_TAG, "max");
}
