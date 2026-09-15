import { revalidateTag, unstable_cache } from "next/cache";
import {
  getPublicHomeData,
  publicHomeUpcomingWindow,
  type PublicHomeData,
} from "@/application/home/get-public-home-data";
import { shouldExposeHomeDebug } from "@/config/home-debug";
import { homePerfLog } from "@/infrastructure/db/home-perf";

/**
 * Scope cache Home publique — slug territoire futur-proof
 * (`public-home:tours` demain) sans modèle Territory aujourd’hui.
 */
export const PUBLIC_HOME_TERRITORY_SLUG = "orleans";

export const PUBLIC_HOME_CACHE_TAG = `public-home:${PUBLIC_HOME_TERRITORY_SLUG}`;

/** TTL de sécurité long — fraîcheur principale = invalidation post-sync. */
export const PUBLIC_HOME_CACHE_REVALIDATE_SECONDS = 60 * 60 * 6;

/**
 * Read model public Home via Data Cache Next (`unstable_cache` + tag).
 * Ne doit jamais recevoir de userId / session / favoris.
 */
export async function getCachedPublicHomeData(): Promise<PublicHomeData> {
  let computeRan = false;

  const cached = unstable_cache(
    async () => {
      computeRan = true;
      homePerfLog(
        `public_home_compute territory=${PUBLIC_HOME_TERRITORY_SLUG}`,
      );
      const { from, to } = publicHomeUpcomingWindow();
      return getPublicHomeData({
        from,
        to,
        exposeDebug: shouldExposeHomeDebug(),
      });
    },
    ["detour-public-home", PUBLIC_HOME_TERRITORY_SLUG],
    {
      tags: [PUBLIC_HOME_CACHE_TAG],
      revalidate: PUBLIC_HOME_CACHE_REVALIDATE_SECONDS,
    },
  );

  const data = await cached();
  homePerfLog(
    `public_home=${computeRan ? "miss" : "hit"} territory=${PUBLIC_HOME_TERRITORY_SLUG}`,
  );
  return data;
}

/**
 * Invalidation immédiate (Route Handlers post-sync).
 * `{ expire: 0 }` → prochain hit = miss bloquant (pas de SWR stale).
 */
export function invalidatePublicHomeCache(): void {
  revalidateTag(PUBLIC_HOME_CACHE_TAG, { expire: 0 });
}
