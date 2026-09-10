import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";

/** Config de génération incluse dans l’identité de cache provider. */
export type AiAssessmentGenerationConfig = {
  temperature: number;
};

/** Identité de cache partagée provider ↔ couche cache (model / prompt / génération). */
export type AiAssessmentCacheContext = {
  model: string;
  promptVersion: string;
  generation: AiAssessmentGenerationConfig;
};

/** Port : évaluation IA des highlights (indépendant de l’impl OpenAI / Noop). */
export interface HighlightAssessmentProvider {
  assess(events: DetourEvent[]): Promise<AiHighlightAssessment[]>;
  /** Identité de cache — pas de coupling au provider concret. */
  readonly cacheContext: AiAssessmentCacheContext;
}
