import { updateTag, unstable_cache } from "next/cache";
import {
  AI_ASSESSMENT_CACHE_TTL_SECONDS,
  type AiAssessmentCacheEntry,
} from "@/application/ai/ai-assessment-cache";

export function createNextAiAssessmentReadThrough(): (
  cacheKey: string,
  compute: () => Promise<AiAssessmentCacheEntry>,
) => Promise<AiAssessmentCacheEntry> {
  return (cacheKey, compute) => {
    const cached = unstable_cache(compute, ["detour-ai-assessments", cacheKey], {
      revalidate: AI_ASSESSMENT_CACHE_TTL_SECONDS,
      tags: [aiAssessmentCacheTag(cacheKey)],
    });
    return cached();
  };
}

/**
 * Invalidation immédiate (Server Actions).
 * `updateTag` expire le tag sans stale-while-revalidate — adapté au force refresh.
 */
export function invalidateNextAiAssessmentCache(cacheKey: string): void {
  updateTag(aiAssessmentCacheTag(cacheKey));
}

export function aiAssessmentCacheTag(cacheKey: string): string {
  return `detour-ai-assessments-${cacheKey}`;
}
