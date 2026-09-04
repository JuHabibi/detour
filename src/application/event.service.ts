import { classifyEventRelevance } from "@/domain/classify-event-relevance";
import {
  deduplicateEvents,
  type EventDuplicate,
} from "@/domain/deduplicate-events";
import type { DetourEvent } from "@/domain/event";
import {
  rankDetourHighlightCandidates,
  selectDetourHighlights,
  type EventHighlight,
} from "@/domain/select-detour-highlights";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";

export type UpcomingEventsResult = {
  events: DetourEvent[];
  highlights: EventHighlight[];
  /** Top candidats scorés (avant diversité) — debug. */
  highlightCandidates: EventHighlight[];
  /** Nombre total de candidats ayant reçu un score. */
  scoredCandidatesCount: number;
  duplicates: EventDuplicate[];
  rawCount: number;
  classifiedEvents: DetourEvent[];
};

export class EventService {
  constructor(private readonly source: EventSourceAdapter) {}

  async getUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<UpcomingEventsResult> {
    const rawEvents = await this.source.fetchUpcomingEvents(params);

    const classifiedEvents = rawEvents.map((event) => {
      const classification = classifyEventRelevance(event);
      return {
        ...event,
        relevance: classification.relevance,
        relevanceReason: classification.reason,
      };
    });

    const { events, duplicates } = deduplicateEvents(classifiedEvents);
    const rankedCandidates = rankDetourHighlightCandidates(events);
    const highlightCandidates = rankedCandidates.slice(0, 20);
    const highlights = selectDetourHighlights(events, { limit: 4 });

    return {
      events,
      highlights,
      highlightCandidates,
      scoredCandidatesCount: rankedCandidates.length,
      duplicates,
      rawCount: rawEvents.length,
      classifiedEvents,
    };
  }
}
