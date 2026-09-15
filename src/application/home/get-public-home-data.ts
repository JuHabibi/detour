import { EventService } from "@/application/event.service";
import { buildEventsDebugMeta } from "@/application/build-events-debug-meta";
import type { EventsDebugMeta } from "@/application/debug/events-debug-meta";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import {
  mapDetourEventToEventItem,
  mapDetourHighlightToEventItem,
} from "@/application/map-detour-event-to-ui";
import { getAiConfig } from "@/config/ai-config";
import { shouldExposeHomeDebug } from "@/config/home-debug";
import type { EventItem } from "@/data/types";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import {
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
} from "@/infrastructure/ai/next-ai-assessment-cache";
import { createHomeEventSource } from "@/infrastructure/create-detour-event-source";

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

/** Read model public Home — aucun user / session / favori. */
export type PublicHomeData = {
  highlights: EventItem[];
  planningEvents: EventItem[];
  explorer: {
    events: EventItem[];
    totalCount: number;
    nextCursor: string | null;
  };
  debugEvents?: EventItem[];
  debugMeta?: EventsDebugMeta;
};

export type GetPublicHomeDataParams = {
  from: Date;
  to: Date;
  /** Env-based (pas user). Inclus dans le compute, pas dans une clé user. */
  exposeDebug?: boolean;
};

/**
 * Charge Radar + planning + Explorer initial pour la Home.
 * Page-loader helper — pas de données authentifiées.
 */
export async function getPublicHomeData(
  params: GetPublicHomeDataParams,
): Promise<PublicHomeData> {
  const exposeDebug = params.exposeDebug ?? shouldExposeHomeDebug();

  const [result, explorerPage] = await Promise.all([
    eventService.getUpcomingEvents({ from: params.from, to: params.to }),
    listExplorerEvents({ when: "weekend", limit: 12 }),
  ]);

  return {
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

/** Fenêtre calendaire alignée sur loadHomePage historique. */
export function publicHomeUpcomingWindow(now: Date = new Date()): {
  from: Date;
  to: Date;
} {
  const from = new Date(now);
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);
  return { from, to };
}
