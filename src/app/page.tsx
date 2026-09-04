import { EventService } from "@/application/event.service";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { HomePage } from "@/components/HomePage";
import type {
  EventDuplicateDebug,
  HighlightDebug,
} from "@/components/EventsDebugPanel";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import type { EventHighlight } from "@/domain/select-detour-highlights";

const UPCOMING_WINDOW_DAYS = 180;

const eventService = new EventService(new OrleansEventAdapter());

function toHighlightDebug(
  highlight: EventHighlight,
  rank?: number,
): HighlightDebug {
  return {
    title: highlight.event.title,
    score: highlight.score,
    planningScore: highlight.planningScore,
    reasons: highlight.reasons,
    source: highlight.event.source,
    city: highlight.event.city,
    hasRegistration: Boolean(highlight.event.registrationUrl),
    rank,
    slot: highlight.slot,
  };
}

export default async function Page() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  const {
    events,
    highlights,
    highlightCandidates,
    scoredCandidatesCount,
    duplicates,
    rawCount,
    classifiedEvents,
  } = await eventService.getUpcomingEvents({ from, to });

  const byId = new Map(
    classifiedEvents.map((event) => [event.id, event] as const),
  );

  const duplicateDebug: EventDuplicateDebug[] = duplicates.map((duplicate) => {
    const kept = byId.get(duplicate.keptId);
    const removed = byId.get(duplicate.duplicateId);

    return {
      keptTitle: kept?.title ?? duplicate.keptId,
      duplicateTitle: removed?.title ?? duplicate.duplicateId,
      date: kept?.startAt ?? removed?.startAt ?? "",
      venue: kept?.venue ?? removed?.venue ?? null,
      city: kept?.city ?? removed?.city ?? null,
      reason: duplicate.reason,
    };
  });

  return (
    <HomePage
      events={events.map((event) => mapDetourEventToEventItem(event))}
      highlights={highlights.map((highlight) =>
        mapDetourEventToEventItem(highlight.event),
      )}
      debugMeta={{
        rawCount,
        dedupedCount: events.length,
        duplicateCount: duplicates.length,
        scoredCandidatesCount,
        duplicates: duplicateDebug,
        highlights: highlights.map((highlight) => {
          const rank =
            highlightCandidates.findIndex(
              (candidate) => candidate.event.id === highlight.event.id,
            ) + 1;
          return toHighlightDebug(highlight, rank > 0 ? rank : undefined);
        }),
        highlightCandidates: highlightCandidates.map((highlight, index) =>
          toHighlightDebug(highlight, index + 1),
        ),
      }}
    />
  );
}
