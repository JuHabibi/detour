import type { DetourEvent } from "@/domain/event";

export interface EventSourceAdapter {
  fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]>;
}
