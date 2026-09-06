import type { EventDuplicate } from "@/domain/events/deduplicate-events";
import type { DetourEvent } from "@/domain/events/event";
import type {
  EventIngestionResult,
  SourceAdapterId,
  SourceIngestionStatus,
} from "@/application/ingestion/event-ingestion-result";

export type SourceIngestionStat = {
  adapterId: SourceAdapterId;
  sourceName: string;
  status: SourceIngestionStatus;
  rawCount: number;
  /** culture + culture_leisure uniquement (filtre éditorial Détour). */
  classifiedCount: number;
  /** Tous les événements de l’adapter encore présents après dédup (métrique technique). */
  dedupedContribution: number;
  /** culture | culture_leisure encore présents après dédup (métrique métier). */
  editorialContribution: number;
  /** Supprimés comme doublons (duplicateId). */
  duplicatesRemoved: number;
};

const CULTURAL = new Set(["culture", "culture_leisure"]);

/**
 * Stats d’ingestion par adapter — debug uniquement.
 * classifiedCount / editorialContribution = culture|culture_leisure.
 * dedupedContribution = tous les IDs encore présents après dédup.
 */
export function buildSourceIngestionStats(params: {
  ingestion: EventIngestionResult;
  classifiedEvents: DetourEvent[];
  dedupedEvents: DetourEvent[];
  duplicates: EventDuplicate[];
}): SourceIngestionStat[] {
  const {
    ingestion,
    classifiedEvents,
    dedupedEvents,
    duplicates,
  } = params;

  const classifiedById = new Map(
    classifiedEvents.map((event) => [event.id, event] as const),
  );
  const dedupedIds = new Set(dedupedEvents.map((event) => event.id));
  const removedIds = new Set(duplicates.map((item) => item.duplicateId));

  return ingestion.adapterOrder.map((adapterId) => {
    const eventIds = [...ingestion.adapterByEventId.entries()]
      .filter(([, id]) => id === adapterId)
      .map(([eventId]) => eventId);

    let classifiedCount = 0;
    let dedupedContribution = 0;
    let editorialContribution = 0;
    let duplicatesRemoved = 0;

    for (const eventId of eventIds) {
      const classified = classifiedById.get(eventId);
      const isCultural =
        !!classified?.relevance && CULTURAL.has(classified.relevance);
      const keptAfterDedup = dedupedIds.has(eventId);

      if (isCultural) classifiedCount += 1;
      if (keptAfterDedup) dedupedContribution += 1;
      if (isCultural && keptAfterDedup) editorialContribution += 1;
      if (removedIds.has(eventId)) duplicatesRemoved += 1;
    }

    return {
      adapterId,
      sourceName:
        ingestion.sourceNameByAdapter.get(adapterId) ?? adapterId,
      status: ingestion.statusByAdapter.get(adapterId) ?? "ok",
      rawCount: ingestion.rawCountByAdapter.get(adapterId) ?? 0,
      classifiedCount,
      dedupedContribution,
      editorialContribution,
      duplicatesRemoved,
    };
  });
}
