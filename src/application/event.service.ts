import { classifyEventRelevance } from "@/domain/classify-event-relevance";
import {
  deduplicateEvents,
  type EventDuplicate,
} from "@/domain/deduplicate-events";
import type { DetourEvent } from "@/domain/event";
import {
  selectDetourHighlights,
  type EventHighlight,
} from "@/domain/select-detour-highlights";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";

export type UpcomingEventsResult = {
  events: DetourEvent[];
  highlights: EventHighlight[];
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
    const highlights = selectDetourHighlights(events, { limit: 4 });

    return {
      events,
      highlights,
      duplicates,
      rawCount: rawEvents.length,
      classifiedEvents,
    };
  }
}
