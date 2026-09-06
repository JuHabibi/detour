import { describe, expect, it } from "vitest";
import { combinedAiScore } from "@/domain/editorial/highlight-assessment";

describe("combinedAiScore", () => {
  it("somme appeal + missRisk + planningNeed + localRarity + likelyDemand", () => {
    expect(
      combinedAiScore({
        eventId: "a",
        appeal: 4,
        missRisk: 5,
        planningNeed: 3,
        localRarity: 2,
        likelyDemand: 1,
        confidence: 0.9,
        reasons: [],
      }),
    ).toBe(15);
  });
});
