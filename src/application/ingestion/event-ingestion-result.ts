import type { DetourEvent } from "@/domain/events/event";

/** Identifiant technique d’adapter (interne pipeline/debug). */
export type SourceAdapterId = string;

/** Santé d’une source à l’ingestion — ok même si 0 event. */
export type SourceIngestionStatus = "ok" | "error";

export type EventIngestionResult = {
  events: DetourEvent[];
  /** event.id → adapterId */
  adapterByEventId: Map<string, SourceAdapterId>;
  /** Compteurs bruts par adapter (0 si échec / vide). */
  rawCountByAdapter: Map<SourceAdapterId, number>;
  /** ok = fetch résolu (même []) ; error = throw isolé. */
  statusByAdapter: Map<SourceAdapterId, SourceIngestionStatus>;
  /** Libellés d’affichage debug. */
  sourceNameByAdapter: Map<SourceAdapterId, string>;
  /** Ordre stable des adapters déclarés. */
  adapterOrder: SourceAdapterId[];
};

/** Au moins une source en erreur → ingestion partielle (non cacheable). */
export function isPartialIngestion(result: EventIngestionResult): boolean {
  for (const status of result.statusByAdapter.values()) {
    if (status === "error") return true;
  }
  return false;
}

/** Ingestion synthétique quand la source n’expose pas `ingestUpcomingEvents`. */
export function ingestionFromPlainEvents(
  events: DetourEvent[],
  adapterId = "default",
  sourceName = "Default source",
): EventIngestionResult {
  const adapterByEventId = new Map<string, string>();
  for (const event of events) {
    adapterByEventId.set(event.id, adapterId);
  }
  return {
    events,
    adapterByEventId,
    rawCountByAdapter: new Map([[adapterId, events.length]]),
    statusByAdapter: new Map([[adapterId, "ok"]]),
    sourceNameByAdapter: new Map([[adapterId, sourceName]]),
    adapterOrder: [adapterId],
  };
}
