import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";
import type { HighlightAssessmentProvider } from "@/application/ports/highlight-assessment";
import {
  AI_ASSESSMENT_DEFAULT_MODEL,
  AI_ASSESSMENT_DEFAULT_TEMPERATURE,
  AI_ASSESSMENT_PROMPT_VERSION,
} from "@/infrastructure/ai/openai-highlight-assessment.provider";

export class NoopHighlightAssessmentProvider
  implements HighlightAssessmentProvider
{
  readonly cacheContext = {
    model: AI_ASSESSMENT_DEFAULT_MODEL,
    promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
    generation: { temperature: AI_ASSESSMENT_DEFAULT_TEMPERATURE },
  };

  async assess(_events: DetourEvent[]): Promise<AiHighlightAssessment[]> {
    return [];
  }
}
