import { classifyEventRelevance } from "@/domain/events/classify-event-relevance";
import {
  deduplicateEvents,
  type EventDuplicate,
} from "@/domain/events/deduplicate-events";
import type { DetourEvent } from "@/domain/events/event";
import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";
import { buildAiHighlightShortlist } from "@/domain/build-ai-highlight-shortlist";
import { filterStillActiveEvents } from "@/domain/events/is-event-still-active";
import {
  AI_DETOUR_DEFAULT_LIMIT,
  selectAiDetourHighlights,
} from "@/domain/editorial/select-ai-detour-highlights";
import {
  rankDetourHighlightCandidates,
  selectDetourHighlights,
  type EventHighlight,
} from "@/domain/editorial/select-detour-highlights";
import {
  getAiConfig,
  type AiConfig,
  type AiDisplayMode,
} from "@/config/ai-config";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";
import { NoopHighlightAssessmentProvider } from "@/infrastructure/ai/noop-highlight-assessment.provider";
import {
  assessHighlightsCached,
  type AiAssessmentCacheEntry,
  type AiAssessmentCacheSource,
  type AiAssessmentCacheStore,
  type AssessHighlightsCachedResult,
} from "@/infrastructure/ai/ai-assessment-cache";
import {
  selectPlanningEvents,
  type PlanningEvent,
} from "@/domain/editorial/select-planning-events";
import {
  isIngestingEventSource,
} from "@/infrastructure/composite-event-source.adapter";
import {
  buildSaranClassificationAudit,
  buildSaranDuplicateDebug,
  type SaranClassificationAudit,
  type SaranDuplicateDebug,
} from "@/application/debug/saran-ingestion-debug";
import {
  ingestionFromPlainEvents,
  type EventIngestionResult,
} from "@/application/ingestion/event-ingestion-result";
import {
  buildSourceIngestionStats,
  type SourceIngestionStat,
} from "@/application/ingestion/source-ingestion-stats";
import type {
  AiShortlistBucketStats,
  AiShortlistInclusionReason,
} from "@/domain/build-ai-highlight-shortlist";

export type UpcomingEventsAiMeta = {
  displayMode: AiDisplayMode;
  mode: AiConfig["mode"];
  enabled: boolean;
  source: AiAssessmentCacheSource;
  /** @deprecated Toujours null — cache per-event. */
  cacheKey: string | null;
  cacheHits: number;
  cacheMisses: number;
  assessedAt: string | null;
};

export type UpcomingEventsResult = {
  events: DetourEvent[];
  highlights: EventHighlight[];
  planningEvents: PlanningEvent[];
  highlightCandidates: EventHighlight[];
  aiShortlist: EventHighlight[];
  /** Raisons d’inclusion du pool IA (debug). */
  aiShortlistInclusion: Record<string, AiShortlistInclusionReason[]>;
  aiShortlistBucketSizes: AiShortlistBucketStats;
  scoredCandidatesCount: number;
  aiAssessments: AiHighlightAssessment[];
  aiMeta: UpcomingEventsAiMeta;
  duplicates: EventDuplicate[];
  rawCount: number;
  classifiedEvents: DetourEvent[];
  /** Stats d’ingestion par adapter (debug). */
  sourceIngestion: SourceIngestionStat[];
  /** Doublons impliquant Saran (debug). */
  saranDuplicates: SaranDuplicateDebug[];
  /** Audit classification Saran (debug temporaire). */
  saranClassificationAudit: SaranClassificationAudit;
};

export type EventServiceOptions = {
  aiConfig?: AiConfig;
  cacheStore?: AiAssessmentCacheStore;
  readThrough?: (
    cacheKey: string,
    compute: () => Promise<AiAssessmentCacheEntry>,
  ) => Promise<AiAssessmentCacheEntry>;
  onForceInvalidate?: (cacheKey: string) => void | Promise<void>;
};

export class EventService {
  private readonly aiConfig: AiConfig;
  private readonly cacheStore?: AiAssessmentCacheStore;
  private readonly readThrough?: EventServiceOptions["readThrough"];
  private readonly onForceInvalidate?: EventServiceOptions["onForceInvalidate"];

  constructor(
    private readonly source: EventSourceAdapter,
    private readonly highlightAssessor: HighlightAssessmentProvider = new NoopHighlightAssessmentProvider(),
    options: EventServiceOptions = {},
  ) {
    this.aiConfig = options.aiConfig ?? getAiConfig();
    this.cacheStore = options.cacheStore;
    this.readThrough = options.readThrough;
    this.onForceInvalidate = options.onForceInvalidate;
  }

  async getUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<UpcomingEventsResult> {
    const pipeline = await this.buildPipeline(params);
    const autoAi =
      this.aiConfig.enabled && this.aiConfig.mode === "auto"
        ? await this.assessShortlist(pipeline.aiShortlist, { force: false })
        : null;

    return this.composeResult(pipeline, autoAi);
  }

  async runManualAiAssessment(params: {
    from: Date;
    to: Date;
    force?: boolean;
  }): Promise<UpcomingEventsResult> {
    if (!this.aiConfig.enabled) {
      throw new Error("AI assessment disabled (missing API key)");
    }
    if (this.aiConfig.mode !== "manual") {
      throw new Error("Manual AI assessment is only available in manual mode");
    }

    const pipeline = await this.buildPipeline(params);
    const assessed = await this.assessShortlist(pipeline.aiShortlist, {
      force: params.force ?? false,
    });
    return this.composeResult(pipeline, assessed);
  }

  private async ingestRaw(params: {
    from: Date;
    to: Date;
  }): Promise<EventIngestionResult> {
    if (isIngestingEventSource(this.source)) {
      return this.source.ingestUpcomingEvents(params);
    }
    const events = await this.source.fetchUpcomingEvents(params);
    return ingestionFromPlainEvents(events);
  }

  private async buildPipeline(params: { from: Date; to: Date }) {
    const ingestion = await this.ingestRaw(params);
    // Fraîcheur explicite : hors relevance / dedup — bornes Date (params.from = now home).
    const rawEvents = filterStillActiveEvents(ingestion.events, params.from);

    const classifiedEvents = rawEvents.map((event) => {
      const classification = classifyEventRelevance(event);
      return {
        ...event,
        relevance: classification.relevance,
        relevanceReason: classification.reason,
      };
    });

    const { events, duplicates } = deduplicateEvents(classifiedEvents);
    const rankedCandidates = rankDetourHighlightCandidates(events);
    const highlightCandidates = rankedCandidates.slice(0, 20);
    const builtShortlist = buildAiHighlightShortlist(rankedCandidates);
    const aiShortlist = builtShortlist.shortlist;
    const aiShortlistInclusion = Object.fromEntries(
      builtShortlist.inclusionById.entries(),
    );
    const aiShortlistBucketSizes = builtShortlist.bucketSizes;

    return {
      ingestion,
      rawEvents,
      classifiedEvents,
      events,
      duplicates,
      rankedCandidates,
      highlightCandidates,
      aiShortlist,
      aiShortlistInclusion,
      aiShortlistBucketSizes,
    };
  }

  private composeResult(
    pipeline: Awaited<ReturnType<EventService["buildPipeline"]>>,
    assessed: AssessHighlightsCachedResult | null,
  ): UpcomingEventsResult {
    const aiAssessments = assessed?.assessments ?? [];
    const aiHighlights = selectAiDetourHighlights(
      pipeline.aiShortlist,
      aiAssessments,
      { limit: AI_DETOUR_DEFAULT_LIMIT },
    );

    const highlights =
      aiHighlights.length > 0
        ? aiHighlights
        : selectDetourHighlights(pipeline.events, {
            limit: AI_DETOUR_DEFAULT_LIMIT,
          }).map(
            (highlight) => ({
              ...highlight,
              selectionSource: "deterministic" as const,
            }),
          );

    const planningEvents = selectPlanningEvents({
      events: pipeline.events,
      aiAssessments,
      excludedEventIds: highlights.map((item) => item.event.id),
      deterministicCandidates: pipeline.rankedCandidates,
    });

    const sourceIngestion = buildSourceIngestionStats({
      ingestion: pipeline.ingestion,
      classifiedEvents: pipeline.classifiedEvents,
      dedupedEvents: pipeline.events,
      duplicates: pipeline.duplicates,
    });

    const saranDuplicates = buildSaranDuplicateDebug({
      duplicates: pipeline.duplicates,
      classifiedEvents: pipeline.classifiedEvents,
      adapterByEventId: pipeline.ingestion.adapterByEventId,
    });

    const saranClassificationAudit = buildSaranClassificationAudit({
      classifiedEvents: pipeline.classifiedEvents,
      adapterByEventId: pipeline.ingestion.adapterByEventId,
    });

    return {
      events: pipeline.events,
      highlights,
      planningEvents,
      highlightCandidates: pipeline.highlightCandidates,
      aiShortlist: pipeline.aiShortlist,
      aiShortlistInclusion: pipeline.aiShortlistInclusion,
      aiShortlistBucketSizes: pipeline.aiShortlistBucketSizes,
      scoredCandidatesCount: pipeline.rankedCandidates.length,
      aiAssessments,
      aiMeta: {
        displayMode: this.aiConfig.displayMode,
        mode: this.aiConfig.mode,
        enabled: this.aiConfig.enabled,
        source: assessed?.source ?? "fallback",
        cacheKey: assessed?.cacheKey ?? null,
        cacheHits: assessed?.cacheHits ?? 0,
        cacheMisses: assessed?.cacheMisses ?? 0,
        assessedAt: assessed?.assessedAt ?? null,
      },
      duplicates: pipeline.duplicates,
      rawCount: pipeline.rawEvents.length,
      classifiedEvents: pipeline.classifiedEvents,
      sourceIngestion,
      saranDuplicates,
      saranClassificationAudit,
    };
  }

  private async assessShortlist(
    shortlist: EventHighlight[],
    options: { force: boolean },
  ): Promise<AssessHighlightsCachedResult> {
    const events = shortlist.map((item) => item.event);

    return assessHighlightsCached({
      events,
      force: options.force,
      store: this.cacheStore,
      readThrough: this.readThrough,
      onForceInvalidate: this.onForceInvalidate,
      cacheContext: this.highlightAssessor.cacheContext,
      assess: async (batch) => {
        try {
          return await this.highlightAssessor.assess(batch);
        } catch (error) {
          console.error("[detour] AI highlight assessment failed", error);
          throw error;
        }
      },
    });
  }
}
