import { getCachedPublicHomeData } from "@/infrastructure/next-public-home-cache";

/**
 * Charge la Home publique (cache) — sans session ni favoris.
 * Auth / favoris : hydratation client après paint.
 */
export async function loadHomePage() {
  const publicData = await getCachedPublicHomeData();

  return {
    highlights: publicData.highlights,
    planningEvents: publicData.planningEvents,
    explorer: publicData.explorer,
    debugEvents: publicData.debugEvents,
    debugMeta: publicData.debugMeta,
  };
}
