import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { EventIngestionResult } from "@/application/source-ingestion-stats";

export type NamedEventSource = {
  /** Id technique : orleans | saran | … */
  name: string;
  /** Libellé debug : Orléans / OpenAgenda, Ville de Saran… */
  label: string;
  adapter: EventSourceAdapter;
};

export type IngestingEventSource = {
  ingestUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<EventIngestionResult>;
};

/**
 * Agrège plusieurs sources avec provenance adapterId.
 * Une source en erreur n’interrompt pas les autres (rawCount = 0).
 */
export class CompositeEventSourceAdapter
  implements EventSourceAdapter, IngestingEventSource
{
  constructor(private readonly sources: NamedEventSource[]) {}

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const ingestion = await this.ingestUpcomingEvents(params);
    return ingestion.events;
  }

  async ingestUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<EventIngestionResult> {
    const adapterByEventId = new Map<string, string>();
    const rawCountByAdapter = new Map<string, number>();
    const sourceNameByAdapter = new Map<string, string>();
    const adapterOrder = this.sources.map(({ name }) => name);
    const allEvents: DetourEvent[] = [];

    for (const { name, label } of this.sources) {
      sourceNameByAdapter.set(name, label);
      rawCountByAdapter.set(name, 0);
    }

    const batches = await Promise.all(
      this.sources.map(async ({ name, adapter }) => {
        try {
          const events = await adapter.fetchUpcomingEvents(params);
          return { name, events };
        } catch (error) {
          console.error(`[detour] event source failed: ${name}`, error);
          return { name, events: [] as DetourEvent[] };
        }
      }),
    );

    for (const { name, events } of batches) {
      rawCountByAdapter.set(name, events.length);
      for (const event of events) {
        adapterByEventId.set(event.id, name);
        allEvents.push(event);
      }
    }

    return {
      events: allEvents,
      adapterByEventId,
      rawCountByAdapter,
      sourceNameByAdapter,
      adapterOrder,
    };
  }
}

export function isIngestingEventSource(
  source: EventSourceAdapter | IngestingEventSource,
): source is IngestingEventSource {
  return (
    typeof (source as IngestingEventSource).ingestUpcomingEvents === "function"
  );
}
