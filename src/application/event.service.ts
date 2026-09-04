import { classifyEventRelevance } from "@/domain/classify-event-relevance";
import {
  deduplicateEvents,
  type EventDuplicate,
} from "@/domain/deduplicate-events";
import type { DetourEvent } from "@/domain/event";
import {
  AI_HIGHLIGHT_SHORTLIST_SIZE,
  type AiHighlightAssessment,
} from "@/domain/ai-highlight-assessment";
import { selectAiDetourHighlights } from "@/domain/select-ai-detour-highlights";
import {
  rankDetourHighlightCandidates,
  selectDetourHighlights,
  type EventHighlight,
} from "@/domain/select-detour-highlights";
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
} from "@/domain/select-planning-events";

export type UpcomingEventsAiMeta = {
  displayMode: AiDisplayMode;
  mode: AiConfig["mode"];
  enabled: boolean;
  source: AiAssessmentCacheSource;
  cacheKey: string | null;
  assessedAt: string | null;
};

export type UpcomingEventsResult = {
  events: DetourEvent[];
  highlights: EventHighlight[];
  /** Section « À prévoir » — anticipation, hors Faites un détour. */
  planningEvents: PlanningEvent[];
  /** Top candidats scorés (avant diversité) — debug. */
  highlightCandidates: EventHighlight[];
  /** Shortlist envoyée à l’IA (top N déterministe). */
  aiShortlist: EventHighlight[];
  /** Nombre total de candidats ayant reçu un score. */
  scoredCandidatesCount: number;
  /** Évaluations IA sur la shortlist — debug. */
  aiAssessments: AiHighlightAssessment[];
  aiMeta: UpcomingEventsAiMeta;
  duplicates: EventDuplicate[];
  rawCount: number;
  classifiedEvents: DetourEvent[];
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

  /**
   * Déclenchement manuel (debug) — shortlist Détour uniquement, pas de prompt libre.
   */
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

  private async buildPipeline(params: { from: Date; to: Date }) {
    const rawEvents = await this.source.fetchUpcomingEvents(params);

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
    const aiShortlist = rankedCandidates.slice(0, AI_HIGHLIGHT_SHORTLIST_SIZE);

    return {
      rawEvents,
      classifiedEvents,
      events,
      duplicates,
      rankedCandidates,
      highlightCandidates,
      aiShortlist,
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
      { limit: 4 },
    );

    const highlights =
      aiHighlights.length > 0
        ? aiHighlights
        : selectDetourHighlights(pipeline.events, { limit: 4 }).map(
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

    return {
      events: pipeline.events,
      highlights,
      planningEvents,
      highlightCandidates: pipeline.highlightCandidates,
      aiShortlist: pipeline.aiShortlist,
      scoredCandidatesCount: pipeline.rankedCandidates.length,
      aiAssessments,
      aiMeta: {
        displayMode: this.aiConfig.displayMode,
        mode: this.aiConfig.mode,
        enabled: this.aiConfig.enabled,
        source: assessed?.source ?? "fallback",
        cacheKey: assessed?.cacheKey ?? null,
        assessedAt: assessed?.assessedAt ?? null,
      },
      duplicates: pipeline.duplicates,
      rawCount: pipeline.rawEvents.length,
      classifiedEvents: pipeline.classifiedEvents,
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
