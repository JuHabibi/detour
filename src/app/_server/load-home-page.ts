import { EventService } from "@/application/event.service";
import { buildEventsDebugMeta } from "@/application/build-events-debug-meta";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import {
  mapDetourEventToEventItem,
  mapDetourHighlightToEventItem,
} from "@/application/map-detour-event-to-ui";
import { getAiConfig } from "@/config/ai-config";
import { shouldExposeHomeDebug } from "@/config/home-debug";
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

/** Charge les données Home (radar, explorer, debug) pour `page.tsx`. */
export async function loadHomePage() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  const exposeDebug = shouldExposeHomeDebug();

  const [result, explorerPage] = await Promise.all([
    eventService.getUpcomingEvents({ from, to }),
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
