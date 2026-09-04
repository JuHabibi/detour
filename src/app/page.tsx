import { EventService } from "@/application/event.service";
import { buildEventsDebugMeta } from "@/application/build-events-debug-meta";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { HomePage } from "@/components/HomePage";
import { getAiConfig } from "@/config/ai-config";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import {
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
} from "@/infrastructure/ai/next-ai-assessment-cache";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";

const UPCOMING_WINDOW_DAYS = 180;

const eventService = new EventService(
  new OrleansEventAdapter(),
  createHighlightAssessmentProvider(),
  {
    aiConfig: getAiConfig(),
    readThrough: createNextAiAssessmentReadThrough(),
    onForceInvalidate: invalidateNextAiAssessmentCache,
  },
);

export default async function Page() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  const result = await eventService.getUpcomingEvents({ from, to });

  return (
    <HomePage
      events={result.events.map((event) => mapDetourEventToEventItem(event))}
      highlights={result.highlights.map((highlight) =>
        mapDetourEventToEventItem(highlight.event),
      )}
      planningEvents={result.planningEvents.map((item) =>
        mapDetourEventToEventItem(item.event),
      )}
      debugMeta={buildEventsDebugMeta(result)}
    />
  );
}
