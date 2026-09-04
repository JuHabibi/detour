import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";
import { NoopHighlightAssessmentProvider } from "@/infrastructure/ai/noop-highlight-assessment.provider";
import { OpenAiHighlightAssessmentProvider } from "@/infrastructure/ai/openai-highlight-assessment.provider";

/**
 * Active l’évaluation IA si une clé est présente.
 * Env : DETOUR_AI_API_KEY (ou OPENAI_API_KEY),
 * optionnel DETOUR_AI_BASE_URL, DETOUR_AI_MODEL.
 */
export function createHighlightAssessmentProvider(
  env: NodeJS.ProcessEnv = process.env,
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
