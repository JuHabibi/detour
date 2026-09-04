import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";

export class EventService {
  constructor(private readonly source: EventSourceAdapter) {}

  getUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    return this.source.fetchUpcomingEvents(params);
  }
}
