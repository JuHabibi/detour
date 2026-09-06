import type {
  EventIngestionResult,
  SourceIngestionStatus,
} from "@/application/ingestion/event-ingestion-result";
import type { DetourEvent } from "@/domain/events/event";
import type { IngestingEventSource } from "@/infrastructure/composite-event-source.adapter";
import {
  listUpcomingActiveWithAdapter,
} from "@/infrastructure/db/event.repository";
import type { EventWithAdapter } from "@/infrastructure/db/event-row.mapper";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";

/** Labels alignés sur createDetourEventSource / composite home. */
const ADAPTER_LABELS: Record<string, string> = {
  orleans: "Orléans / OpenAgenda",
  saran: "Ville de Saran",
};

const ADAPTER_ORDER_PREFERRED = ["orleans", "saran"] as const;

export type ListUpcomingActiveWithAdapter = (params: {
  from: Date;
  to: Date;
}) => Promise<EventWithAdapter[]>;

/**
 * Lecture PostgreSQL normalisée — pas de sync, pas d’HTTP, pas de métier.
 * statusByAdapter="ok" = lecture DB courante OK (pas la santé sync externe).
 */
export class DatabaseEventSourceAdapter
  implements EventSourceAdapter, IngestingEventSource
{
  constructor(
    private readonly listUpcoming: ListUpcomingActiveWithAdapter = listUpcomingActiveWithAdapter,
  ) {}

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
    const rows = await this.listUpcoming(params);
    return buildIngestionFromDbRows(rows);
  }
}

export function buildIngestionFromDbRows(
  rows: EventWithAdapter[],
): EventIngestionResult {
  const adapterByEventId = new Map<string, string>();
  const rawCountByAdapter = new Map<string, number>();
  const events: DetourEvent[] = [];

  for (const row of rows) {
    events.push(row.event);
    adapterByEventId.set(row.event.id, row.adapterId);
    rawCountByAdapter.set(
      row.adapterId,
      (rawCountByAdapter.get(row.adapterId) ?? 0) + 1,
    );
  }

  const seen = new Set(rawCountByAdapter.keys());
  const adapterOrder = [
    ...ADAPTER_ORDER_PREFERRED.filter((id) => seen.has(id)),
    ...[...seen]
      .filter(
        (id) =>
          !(ADAPTER_ORDER_PREFERRED as readonly string[]).includes(id),
      )
      .sort(),
  ];

  const statusByAdapter = new Map<string, SourceIngestionStatus>();
  const sourceNameByAdapter = new Map<string, string>();
  for (const adapterId of adapterOrder) {
    statusByAdapter.set(adapterId, "ok");
    sourceNameByAdapter.set(
      adapterId,
      ADAPTER_LABELS[adapterId] ?? adapterId,
    );
  }

  return {
    events,
    adapterByEventId,
    rawCountByAdapter,
    statusByAdapter,
    sourceNameByAdapter,
    adapterOrder,
  };
}
