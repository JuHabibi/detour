import {
  homePerfLog,
  homePerfNextReqId,
  homePerfPoolMeta,
  homePerfProcessAgeMs,
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
  const processAgeBefore = homePerfProcessAgeMs();

  const publicTimed = await homePerfTimed(() => getCachedPublicHomeData());
  const publicData = publicTimed.value;

  const poolMeta = homePerfPoolMeta();
  const totalMs = Date.now() - tTotal;
  homePerfLog(
    [
      `req=${reqId}`,
      `processAge=${processAgeBefore}ms`,
      processAgeBefore < 5_000 ? "instance=likely_cold" : "instance=warm",
      `pool_create=${poolMeta.poolCreateMs ?? "n/a"}ms`,
      `pool_age=${poolMeta.poolAgeMs ?? "n/a"}ms`,
      `public=${publicTimed.ms}ms`,
      `total=${totalMs}ms`,
    ].join(" "),
  );

  return {
    highlights: publicData.highlights,
    planningEvents: publicData.planningEvents,
    explorer: publicData.explorer,
    debugEvents: publicData.debugEvents,
    debugMeta: publicData.debugMeta,
  };
}
