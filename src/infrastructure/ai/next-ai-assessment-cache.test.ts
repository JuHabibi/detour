import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
const revalidateTag = vi.fn();
const unstable_cache = vi.fn(
  (compute: () => Promise<unknown>) => async () => compute(),
);

vi.mock("next/cache", () => ({
  updateTag,
  revalidateTag,
  unstable_cache,
}));

describe("invalidateNextAiAssessmentCache", () => {
  beforeEach(() => {
    updateTag.mockClear();
    revalidateTag.mockClear();
  });

  it("utilise updateTag (expiration immédiate) et non revalidateTag max", async () => {
    const { invalidateNextAiAssessmentCache, aiAssessmentCacheTag } =
      await import("@/infrastructure/ai/next-ai-assessment-cache");

    invalidateNextAiAssessmentCache("abc123");

    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith(aiAssessmentCacheTag("abc123"));
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
