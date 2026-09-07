import { describe, expect, it } from "vitest";
import {
  editorialScoreChallenger,
  selectChallengerGlobalTop10,
} from "@/application/debug/editorial-eval/challenger-global-ranking";
import type { SnapshotRow } from "@/application/debug/editorial-eval/types";

describe("challenger global ranking", () => {
  it("editorialScore = 2*appeal + miss + plan + rare (sans likelyDemand)", () => {
    expect(
      editorialScoreChallenger({
        appeal: 4,
        missRisk: 2,
        planningNeed: 2,
        localRarity: 0,
      }),
    ).toBe(12);
  });

  it("applique discoveryKey max 1 et ignore likelyDemand dans le rang", () => {
    const rows: SnapshotRow[] = [
      {
        title: "Alpha Event Title Long",
        venue: "Venue A",
        city: "City A",
        startAt: "2026-01-01",
        appeal: 5,
        missRisk: 1,
        planningNeed: 1,
        localRarity: 1,
        likelyDemand: 0,
        confidence: 0.5,
      },
      {
        title: "Alpha Event Title Long",
        venue: "Venue A",
        city: "City A",
        startAt: "2026-01-02",
        appeal: 5,
        missRisk: 1,
        planningNeed: 1,
        localRarity: 1,
        likelyDemand: 5,
        confidence: 0.9,
      },
      {
        title: "Beta Distinct Event Name",
        venue: "Venue B",
        city: "City B",
        startAt: "2026-01-03",
        appeal: 4,
        missRisk: 2,
        planningNeed: 2,
        localRarity: 0,
        likelyDemand: 0,
        confidence: 0.5,
      },
    ];
    const top = selectChallengerGlobalTop10(rows, 2);
    expect(top).toHaveLength(2);
    expect(top[0]?.row.title).toBe("Alpha Event Title Long");
    expect(top[1]?.row.title).toBe("Beta Distinct Event Name");
  });
});
