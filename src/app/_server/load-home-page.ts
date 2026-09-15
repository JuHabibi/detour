import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  homePerfLog,
  homePerfNextReqId,
  homePerfPoolMeta,
  homePerfProcessAgeMs,
  homePerfTimed,
} from "@/infrastructure/db/home-perf";
import { getCachedPublicHomeData } from "@/infrastructure/next-public-home-cache";
import { listFavoriteEventIdsForUser } from "@/infrastructure/db/favorite.repository";

/**
 * Charge la Home : read model public (cache) + auth/favoris (dynamiques).
 */
export async function loadHomePage() {
  const tTotal = Date.now();
  const reqId = homePerfNextReqId();
  const processAgeBefore = homePerfProcessAgeMs();

  const publicP = homePerfTimed(() => getCachedPublicHomeData());
  const authP = homePerfTimed(() => getAccountAuthState());

  const [publicTimed, authTimed] = await Promise.all([publicP, authP]);

  const publicData = publicTimed.value;
  const auth = authTimed.value;

  let favoritesMs = 0;
  const favoriteEventIds =
    auth.status === "authenticated"
      ? await (async () => {
          const timed = await homePerfTimed(() =>
            listFavoriteEventIdsForUser(auth.user.id),
          );
          favoritesMs = timed.ms;
          return timed.value;
        })()
      : [];

  homePerfLog(`favorites=${favoritesMs}ms authStatus=${auth.status}`);

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
      `auth=${authTimed.ms}ms`,
      `favorites=${favoritesMs}ms`,
      `authStatus=${auth.status}`,
      `total=${totalMs}ms`,
    ].join(" "),
  );

  return {
    accountLabel:
      auth.status === "authenticated" ? "Mon compte" : "Se connecter",
    isAuthenticated: auth.status === "authenticated",
    favoriteEventIds,
    highlights: publicData.highlights,
    planningEvents: publicData.planningEvents,
    explorer: publicData.explorer,
    debugEvents: publicData.debugEvents,
    debugMeta: publicData.debugMeta,
  };
}
