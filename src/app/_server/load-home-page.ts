import {
  homePerfLog,
  homePerfNextReqId,
  homePerfTimed,
} from "@/infrastructure/db/home-perf";
import { getCachedPublicHomeData } from "@/infrastructure/next-public-home-cache";

/**
 * Charge la Home publique (cache) — sans session ni favoris.
 * Auth / favoris : hydratation client après paint.
 */
export async function loadHomePage() {
  const tTotal = Date.now();
  const reqId = homePerfNextReqId();
  homePerfLog(`req=${reqId} load_home_start`);

  const publicTimed = await homePerfTimed(() => getCachedPublicHomeData());
  const publicData = publicTimed.value;

  homePerfLog(
    `req=${reqId} public=${publicTimed.ms}ms total=${Date.now() - tTotal}ms highlights=${publicData.highlights.length} explorer=${publicData.explorer.events.length}`,
  );

  return {
    highlights: publicData.highlights,
    planningEvents: publicData.planningEvents,
    explorer: publicData.explorer,
    debugEvents: publicData.debugEvents,
    debugMeta: publicData.debugMeta,
  };
}
