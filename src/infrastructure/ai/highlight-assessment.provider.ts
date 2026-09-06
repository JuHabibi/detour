import type { DetourEvent } from "@/domain/events/event";
import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";
import type { AiAssessmentCacheContext } from "@/infrastructure/ai/ai-assessment-cache-key";

export type { AiAssessmentCacheContext };

export interface HighlightAssessmentProvider {
  assess(events: DetourEvent[]): Promise<AiHighlightAssessment[]>;
  /** Identité de cache (model / prompt / génération) — pas de coupling au provider concret. */
  readonly cacheContext: AiAssessmentCacheContext;
}
