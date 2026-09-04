import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/event";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";

/** Provider inactif — aucun appel réseau. */
export class NoopHighlightAssessmentProvider
  implements HighlightAssessmentProvider
{
  async assess(_events: DetourEvent[]): Promise<AiHighlightAssessment[]> {
    return [];
  }
}
