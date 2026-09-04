import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";

export type NamedEventSource = {
  /** Nom court pour les logs (ex. orleans, saran). */
  name: string;
  adapter: EventSourceAdapter;
};

/**
 * Agrège plusieurs sources. Une source en erreur n’interrompt pas les autres.
 */
export class CompositeEventSourceAdapter implements EventSourceAdapter {
  constructor(private readonly sources: NamedEventSource[]) {}

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const batches = await Promise.all(
      this.sources.map(async ({ name, adapter }) => {
        try {
          return await adapter.fetchUpcomingEvents(params);
        } catch (error) {
          console.error(`[detour] event source failed: ${name}`, error);
          return [] as DetourEvent[];
        }
      }),
    );

    return batches.flat();
  }
}
