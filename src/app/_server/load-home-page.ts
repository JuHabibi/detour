import { EventService } from "@/application/event.service";
import { buildEventsDebugMeta } from "@/application/build-events-debug-meta";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import {
  mapDetourEventToEventItem,
  mapDetourHighlightToEventItem,
} from "@/application/map-detour-event-to-ui";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  homePerfLog,
  homePerfNextReqId,
  homePerfPoolMeta,
  homePerfProcessAgeMs,
  homePerfTimed,
} from "@/infrastructure/db/home-perf";
import { getAiConfig } from "@/config/ai-config";
import { shouldExposeHomeDebug } from "@/config/home-debug";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import {
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
} from "@/infrastructure/ai/next-ai-assessment-cache";
import { createHomeEventSource } from "@/infrastructure/create-detour-event-source";
import { listFavoriteEventIdsForUser } from "@/infrastructure/db/favorite.repository";
import { probePoolConnect } from "@/infrastructure/db/postgres";

const UPCOMING_WINDOW_DAYS = 180;

const eventService = new EventService(
  createHomeEventSource(),
  createHighlightAssessmentProvider(),
  {
    aiConfig: getAiConfig(),
    readThrough: createNextAiAssessmentReadThrough(),
    onForceInvalidate: invalidateNextAiAssessmentCache,
  },
);

/** Charge les données Home (radar, explorer, debug, label Account, favoris) pour `page.tsx`. */
export async function loadHomePage() {
  const tTotal = Date.now();
  const reqId = homePerfNextReqId();
  const processAgeBefore = homePerfProcessAgeMs();

  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  const exposeDebug = shouldExposeHomeDebug();

  // Sonde connexion réelle avant le fan-out (cold Neon / pool).
  const { ms: dbConnectMs } = await homePerfTimed(() => probePoolConnect());

  const eventsP = homePerfTimed(() =>
    eventService.getUpcomingEvents({ from, to }),
  );
  const explorerP = homePerfTimed(() =>
    listExplorerEvents({ when: "weekend", limit: 12 }),
  );
  const authP = homePerfTimed(() => getAccountAuthState());

  const [eventsTimed, explorerTimed, authTimed] = await Promise.all([
    eventsP,
    explorerP,
    authP,
  ]);

  const result = eventsTimed.value;
  const explorerPage = explorerTimed.value;
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

  const poolMeta = homePerfPoolMeta();
  const totalMs = Date.now() - tTotal;
  homePerfLog(
    [
      `req=${reqId}`,
      `processAge=${processAgeBefore}ms`,
      processAgeBefore < 5_000 ? "instance=likely_cold" : "instance=warm",
      `db_connect=${dbConnectMs}ms`,
      `pool_create=${poolMeta.poolCreateMs ?? "n/a"}ms`,
      `pool_age=${poolMeta.poolAgeMs ?? "n/a"}ms`,
      `events=${eventsTimed.ms}ms`,
      `explorer=${explorerTimed.ms}ms`,
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
    highlights: result.highlights.map((highlight) =>
      mapDetourHighlightToEventItem(highlight),
    ),
    planningEvents: result.planningEvents.map((item) =>
      mapDetourEventToEventItem(item.event),
    ),
    explorer: {
      events: explorerPage.events.map((event) =>
        mapDetourEventToEventItem(event),
      ),
      totalCount: explorerPage.totalCount,
      nextCursor: explorerPage.nextCursor,
    },
    debugEvents: exposeDebug
      ? result.events.map((event) => mapDetourEventToEventItem(event))
      : undefined,
    debugMeta: exposeDebug ? buildEventsDebugMeta(result) : undefined,
  };
}
