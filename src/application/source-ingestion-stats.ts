import type { EventDuplicate } from "@/domain/deduplicate-events";
import type { DetourEvent } from "@/domain/event";

/** Identifiant technique d’adapter (interne pipeline/debug). */
export type SourceAdapterId = string;

export type EventIngestionResult = {
  events: DetourEvent[];
  /** event.id → adapterId */
  adapterByEventId: Map<string, SourceAdapterId>;
  /** Compteurs bruts par adapter (0 si échec / vide). */
  rawCountByAdapter: Map<SourceAdapterId, number>;
  /** Libellés d’affichage debug. */
  sourceNameByAdapter: Map<SourceAdapterId, string>;
  /** Ordre stable des adapters déclarés. */
  adapterOrder: SourceAdapterId[];
};

export type SourceIngestionStat = {
  adapterId: SourceAdapterId;
  sourceName: string;
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

export type SaranDuplicateDebug = {
  saranTitle: string;
  saranEventId: string;
  keptTitle: string;
  keptEventId: string;
  keptSource: string | null;
  keptAdapterId: string | null;
  reason: string;
};

export type SaranClassificationAuditRow = {
  eventId: string;
  title: string;
  relevance: string;
  relevanceReason: string | null;
  category: string | null;
  genre: string | null;
  venue: string | null;
  descriptionSnippet: string | null;
};

export type SaranClassificationAudit = {
  total: number;
  culture: number;
  cultureLeisure: number;
  outOfScope: number;
  uncertain: number;
  rows: SaranClassificationAuditRow[];
};

const RELEVANCE_SORT_ORDER: Record<string, number> = {
  out_of_scope: 0,
  uncertain: 1,
  culture_leisure: 2,
  culture: 3,
};

function snippetDescription(
  description: string | null,
  maxLen = 120,
): string | null {
  if (!description) return null;
  const compact = description.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 1)}…`;
}

/** Audit debug classification des événements de l’adapter saran (pré-règles). */
export function buildSaranClassificationAudit(params: {
  classifiedEvents: DetourEvent[];
  adapterByEventId: Map<string, SourceAdapterId>;
  saranAdapterId?: string;
}): SaranClassificationAudit {
  const saranAdapterId = params.saranAdapterId ?? "saran";
  const saranEvents = params.classifiedEvents.filter(
    (event) => params.adapterByEventId.get(event.id) === saranAdapterId,
  );

  let culture = 0;
  let cultureLeisure = 0;
  let outOfScope = 0;
  let uncertain = 0;

  for (const event of saranEvents) {
    if (event.relevance === "culture") culture += 1;
    else if (event.relevance === "culture_leisure") cultureLeisure += 1;
    else if (event.relevance === "out_of_scope") outOfScope += 1;
    else uncertain += 1;
  }

  const rows = [...saranEvents]
    .sort((left, right) => {
      const leftOrder =
        RELEVANCE_SORT_ORDER[left.relevance ?? "uncertain"] ?? 99;
      const rightOrder =
        RELEVANCE_SORT_ORDER[right.relevance ?? "uncertain"] ?? 99;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.title.localeCompare(right.title, "fr");
    })
    .map((event) => ({
      eventId: event.id,
      title: event.title,
      relevance: event.relevance ?? "uncertain",
      relevanceReason: event.relevanceReason ?? null,
      category: event.category,
      genre: event.genre,
      venue: event.venue,
      descriptionSnippet: snippetDescription(event.description),
    }));

  return {
    total: saranEvents.length,
    culture,
    cultureLeisure,
    outOfScope,
    uncertain,
    rows,
  };
}

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
      rawCount: ingestion.rawCountByAdapter.get(adapterId) ?? 0,
      classifiedCount,
      dedupedContribution,
      editorialContribution,
      duplicatesRemoved,
    };
  });
}

/** Doublons où au moins un côté vient de l’adapter saran. */
export function buildSaranDuplicateDebug(params: {
  duplicates: EventDuplicate[];
  classifiedEvents: DetourEvent[];
  adapterByEventId: Map<string, SourceAdapterId>;
  saranAdapterId?: string;
}): SaranDuplicateDebug[] {
  const saranAdapterId = params.saranAdapterId ?? "saran";
  const byId = new Map(
    params.classifiedEvents.map((event) => [event.id, event] as const),
  );

  const rows: SaranDuplicateDebug[] = [];

  for (const duplicate of params.duplicates) {
    const keptAdapter = params.adapterByEventId.get(duplicate.keptId) ?? null;
    const dupAdapter =
      params.adapterByEventId.get(duplicate.duplicateId) ?? null;
    if (keptAdapter !== saranAdapterId && dupAdapter !== saranAdapterId) {
      continue;
    }

    const saranId =
      dupAdapter === saranAdapterId
        ? duplicate.duplicateId
        : duplicate.keptId;
    const saranEvent = byId.get(saranId);
    const keptEvent = byId.get(duplicate.keptId);

    rows.push({
      saranTitle: saranEvent?.title ?? saranId,
      saranEventId: saranId,
      keptTitle: keptEvent?.title ?? duplicate.keptId,
      keptEventId: duplicate.keptId,
      keptSource: keptEvent?.source ?? null,
      keptAdapterId: keptAdapter,
      reason: duplicate.reason,
    });
  }

  return rows;
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
    sourceNameByAdapter: new Map([[adapterId, sourceName]]),
    adapterOrder: [adapterId],
  };
}
