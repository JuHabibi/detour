import { revalidateTag, unstable_cache } from "next/cache";
import {
  getPublicHomeSnapshot,
  materializePublicHomeData,
  publicHomeUpcomingWindow,
  type PublicHomeData,
} from "@/application/home/get-public-home-data";
import { shouldExposeHomeDebug } from "@/config/home-debug";
import { PUBLIC_TERRITORY_SLUG } from "@/config/public-territory";

/**
 * Scope cache Home publique — slug territoire futur-proof
 * (`public-home:tours` demain) sans modèle Territory aujourd’hui.
 * Valeur : `config/public-territory` (partagée avec Explorer, sans couplage module).
 */
export const PUBLIC_HOME_TERRITORY_SLUG = PUBLIC_TERRITORY_SLUG;

export const PUBLIC_HOME_CACHE_TAG = `public-home:${PUBLIC_HOME_TERRITORY_SLUG}`;

/** TTL de sécurité long — fraîcheur principale = invalidation post-sync. */
export const PUBLIC_HOME_CACHE_REVALIDATE_SECONDS = 60 * 60 * 6;

/**
 * Read model public Home via Data Cache Next (`unstable_cache` + tag).
 * Ne doit jamais recevoir de userId / session / favoris.
 *
 * Snapshot (SQL / pipeline Radar) dans `unstable_cache`.
 * Assessment IA matérialisé **après**, hors nest — sinon Next bypass
 * les reads du cache IA per-event (unstable_cache imbriqué).
 * Explorer initial : cache distinct (`next-public-explorer-cache`).
 */
export async function getCachedPublicHomeData(): Promise<PublicHomeData> {
  const cachedSnapshot = unstable_cache(
    async () => {
      const { from, to } = publicHomeUpcomingWindow();
      return getPublicHomeSnapshot({
        from,
        to,
        exposeDebug: shouldExposeHomeDebug(),
      });
    },
    ["detour-public-home", PUBLIC_HOME_TERRITORY_SLUG, "pre-ai-snapshot-slim-v2"],
    {
      tags: [PUBLIC_HOME_CACHE_TAG],
      revalidate: PUBLIC_HOME_CACHE_REVALIDATE_SECONDS,
    },
  );

  const snapshot = await cachedSnapshot();

  // Hors callback unstable_cache parent → reads Data Cache IA effectives.
  return materializePublicHomeData(snapshot);
}

/**
 * Revalidation SWR post-sync (Route Handlers).
 * `"max"` → tag stale : Full Route Cache `/` + Data Cache Home servent
 * l’ancienne valeur immédiatement, régénération en arrière-plan.
 * Ne pas utiliser `{ expire: 0 }` ni `revalidatePath("/")` ici
 * (expire soft tags → premier GET bloquant, headers REVALIDATED lents).
 */
export function invalidatePublicHomeCache(): void {
  revalidateTag(PUBLIC_HOME_CACHE_TAG, "max");
}
