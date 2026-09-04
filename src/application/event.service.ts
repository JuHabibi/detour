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
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";
import { NoopHighlightAssessmentProvider } from "@/infrastructure/ai/noop-highlight-assessment.provider";

export type UpcomingEventsResult = {
  events: DetourEvent[];
  highlights: EventHighlight[];
  /** Top candidats scorés (avant diversité) — debug. */
  highlightCandidates: EventHighlight[];
  /** Shortlist envoyée à l’IA (top N déterministe). */
  aiShortlist: EventHighlight[];
  /** Nombre total de candidats ayant reçu un score. */
  scoredCandidatesCount: number;
  /** Évaluations IA sur la shortlist — debug. */
  aiAssessments: AiHighlightAssessment[];
  duplicates: EventDuplicate[];
  rawCount: number;
  classifiedEvents: DetourEvent[];
};

export class EventService {
  constructor(
    private readonly source: EventSourceAdapter,
    private readonly highlightAssessor: HighlightAssessmentProvider = new NoopHighlightAssessmentProvider(),
  ) {}

  async getUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<UpcomingEventsResult> {
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
    const aiAssessments = await this.assessHighlightsSafely(
      aiShortlist.map((item) => item.event),
    );

    const aiHighlights = selectAiDetourHighlights(aiShortlist, aiAssessments, {
      limit: 4,
    });
    const highlights =
      aiHighlights.length > 0
        ? aiHighlights
        : selectDetourHighlights(events, { limit: 4 }).map((highlight) => ({
            ...highlight,
            selectionSource: "deterministic" as const,
          }));

    return {
      events,
      highlights,
      highlightCandidates,
      aiShortlist,
      scoredCandidatesCount: rankedCandidates.length,
      aiAssessments,
      duplicates,
      rawCount: rawEvents.length,
      classifiedEvents,
    };
  }

  private async assessHighlightsSafely(
    events: DetourEvent[],
  ): Promise<AiHighlightAssessment[]> {
    if (events.length === 0) return [];

    try {
      return await this.highlightAssessor.assess(events);
    } catch (error) {
      console.error("[detour] AI highlight assessment failed", error);
      return [];
    }
  }
}
