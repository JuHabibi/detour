import { classifyEventRelevance } from "@/domain/classify-event-relevance";
import {
  deduplicateEvents,
  type EventDuplicate,
} from "@/domain/deduplicate-events";
import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";

export type UpcomingEventsResult = {
  events: DetourEvent[];
  duplicates: EventDuplicate[];
  rawCount: number;
  /** Snapshot avant dédup — utile au debug pour retrouver les titres retirés. */
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

    return {
      events,
      duplicates,
      rawCount: rawEvents.length,
      classifiedEvents,
    };
  }
}
