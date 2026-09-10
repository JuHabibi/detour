import type { HighlightAssessmentProvider } from "@/application/ports/highlight-assessment";
import { NoopHighlightAssessmentProvider } from "@/infrastructure/ai/noop-highlight-assessment.provider";
import { OpenAiHighlightAssessmentProvider } from "@/infrastructure/ai/openai-highlight-assessment.provider";

export function createHighlightAssessmentProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): HighlightAssessmentProvider {
  const apiKey = env.DETOUR_AI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return new NoopHighlightAssessmentProvider();
  }

  return new OpenAiHighlightAssessmentProvider({
    apiKey,
    baseUrl: env.DETOUR_AI_BASE_URL?.trim() || undefined,
    model: env.DETOUR_AI_MODEL?.trim() || undefined,
  });
}
