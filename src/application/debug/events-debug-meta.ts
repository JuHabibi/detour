import type { RadarEditorialAuditExport } from "@/application/debug/build-radar-editorial-audit";

export type EventDuplicateDebug = {
  keptTitle: string;
  duplicateTitle: string;
  date: string;
  venue: string | null;
  city: string | null;
  reason: string;
};

export type HighlightDebug = {
  title: string;
  score: number;
  planningScore: number;
  reasons: string[];
  source: string | null;
  city: string | null;
  hasRegistration: boolean;
  rank?: number;
  slot?: string;
  selectionSource?: "ai" | "deterministic";
  deterministicRank?: number;
  aiRank?: number;
  /** Scores IA / formule du slot (debug). */
  scoresUsed?: string;
  editorialBadge?: string | null;
  availabilityStatus?: string;
  availabilityProvider?: string | null;
  availabilityCheckedAt?: string | null;
};

export type AiHighlightDebug = {
  eventId: string;
  title: string;
  deterministicRank?: number;
  appeal: number;
  missRisk: number;
  planningNeed: number;
  localRarity: number;
  likelyDemand: number;
  confidence: number;
  reasons: string[];
  combined: number;
  /** Rang debug : Σ des dimensions éditoriales. */
  aiRankTotal?: number;
  /** Rang debug « Détour » — même Σ pour l’instant (poids futurs). */
  aiRankDetour?: number;
};

export type PlanningEventDebug = {
  title: string;
  pool: "ai" | "deterministic-fallback";
  selectionSource: "ai" | "deterministic";
  planningValue: number | null;
  planningScore: number;
  selectionScore: number;
  rankInPool: number;
  date: string;
  city: string | null;
};

export type AiShortlistDebug = {
  eventId: string;
  title: string;
  rank: number;
  score: number;
  planningScore: number;
  city: string | null;
  inclusionReasons: string[];
};

/** Contrat debug applicatif pour le panneau Home (sans secrets). */
export type EventsDebugMeta = {
  rawCount: number;
  dedupedCount: number;
  duplicateCount: number;
  scoredCandidatesCount?: number;
  /** Events exclus du Radar pour sold_out / sold_out_online frais. */
  excludedFromRadarBecauseSoldOut?: Array<{
    id: string;
    title: string;
    availabilityStatus: string;
    availabilityProvider: string | null;
    availabilityCheckedAt: string | null;
  }>;
  duplicates: EventDuplicateDebug[];
  highlights?: HighlightDebug[];
  highlightCandidates?: HighlightDebug[];
  aiShortlist?: AiShortlistDebug[];
  aiShortlistBucketSizes?: {
    "deterministic-top": number;
    "planning-top": number;
    "booking-top": number;
    "peripheral-top": number;
    "future-top": number;
  };
  aiAssessments?: AiHighlightDebug[];
  planningEvents?: PlanningEventDebug[];
  sourceIngestion?: Array<{
    adapterId: string;
    sourceName: string;
    status: "ok" | "error";
    rawCount: number;
    classifiedCount: number;
    dedupedContribution: number;
    editorialContribution: number;
    duplicatesRemoved: number;
  }>;
  saranDuplicates?: Array<{
    saranTitle: string;
    keptTitle: string;
    keptSource: string | null;
    keptAdapterId: string | null;
    reason: string;
  }>;
  saranClassificationAudit?: {
    total: number;
    culture: number;
    cultureLeisure: number;
    outOfScope: number;
    uncertain: number;
    rows: Array<{
      eventId: string;
      title: string;
      relevance: string;
      relevanceReason: string | null;
      category: string | null;
      genre: string | null;
      venue: string | null;
      descriptionSnippet: string | null;
    }>;
  };
  aiRuntime?: {
    mode: "manual" | "auto" | "disabled";
    source: "fresh" | "cache" | "partial" | "fallback";
    /** @deprecated Cache per-event — souvent null. */
    cacheKeyShort: string | null;
    cacheHits?: number;
    cacheMisses?: number;
    assessedAt: string | null;
    canRunManual: boolean;
  };
  /** Export audit éditorial du AI candidate pool (faits + engine séparés). */
  radarEditorialAudit?: RadarEditorialAuditExport;
};
