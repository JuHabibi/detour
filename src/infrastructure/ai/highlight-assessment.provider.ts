import type { DetourEvent } from "@/domain/event";
import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";

export interface HighlightAssessmentProvider {
  assess(events: DetourEvent[]): Promise<AiHighlightAssessment[]>;
}
