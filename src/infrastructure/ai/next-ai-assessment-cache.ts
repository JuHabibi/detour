import { revalidateTag, unstable_cache } from "next/cache";
import {
  AI_ASSESSMENT_CACHE_TTL_SECONDS,
  type AiAssessmentCacheEntry,
} from "@/infrastructure/ai/ai-assessment-cache";


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

export function invalidateNextAiAssessmentCache(cacheKey: string): void {
  revalidateTag(aiAssessmentCacheTag(cacheKey), "max");
}

export function aiAssessmentCacheTag(cacheKey: string): string {
  return `detour-ai-assessments-${cacheKey}`;
}
