import type { EventIngestionResult } from "@/application/ingestion/event-ingestion-result";
import type { DetourEvent } from "@/domain/events/event";

/** Port : source d’événements pour le cœur applicatif (indépendant de l’infra). */
export interface EventSource {
  fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]>;
}

/** Capacité optionnelle : ingestion avec provenance / stats par adapter. */
export type IngestingEventSource = {
  ingestUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<EventIngestionResult>;
};

export function isIngestingEventSource(
  source: EventSource | IngestingEventSource,
): source is IngestingEventSource {
  return (
    typeof (source as IngestingEventSource).ingestUpcomingEvents === "function"
  );
}
