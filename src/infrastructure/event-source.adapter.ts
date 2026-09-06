import type { DetourEvent } from "@/domain/events/event";

export interface EventSourceAdapter {
  fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]>;
}
