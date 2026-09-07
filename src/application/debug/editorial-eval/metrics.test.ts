import { describe, expect, it } from "vitest";
import {
  discountedCumulativeGain,
  mustRecallAtK,
  ndcgAtK,
  matchGoldenItem,
  gainForLabel,
} from "@/application/debug/editorial-eval/metrics";
import type { GoldenSetItem } from "@/application/debug/editorial-eval/types";
import { evaluateEditorialSnapshot } from "@/application/debug/editorial-eval/evaluate-snapshot";

describe("editorial-eval metrics", () => {
  it("mustRecall@10 ignore les MUST hors corpus", () => {
    expect(
      mustRecallAtK({
        radarLabels: ["MUST", "MAYBE", null, "MUST"],
        eligibleMustCount: 5,
      }),
    ).toEqual({ hit: 2, eligible: 5, recall: 0.4 });

    expect(
      mustRecallAtK({
        radarLabels: ["MUST"],
        eligibleMustCount: 0,
      }).recall,
    ).toBeNull();
  });

  it("nDCG@10 : unlabeled gain 0 ; IDCG sur labellisés du corpus", () => {
    const gains = [3, 0, 1];
    const idealPool = [3, 3, 1];
    const score = ndcgAtK(gains, idealPool, 3);
    const dcg = discountedCumulativeGain([3, 0, 1]);
    const idcg = discountedCumulativeGain([3, 3, 1]);
    expect(score).toBeCloseTo(dcg / idcg, 8);
  });

  it("nDCG parfait quand le ranking est idéal", () => {
    const gains = [3, 3, 1, 0];
    expect(ndcgAtK(gains, [3, 3, 1], 4)).toBeCloseTo(1, 8);
  });

  it("UNJUDGEABLE et unlabeled : gain 0", () => {
    expect(gainForLabel("UNJUDGEABLE")).toBe(0);
    expect(gainForLabel(null)).toBe(0);
    expect(gainForLabel("NO")).toBe(0);
    expect(gainForLabel("MUST")).toBe(3);
    expect(gainForLabel("MAYBE")).toBe(1);
  });

  it("matchGoldenItem désambiguïse les homonymes par startAt", () => {
    const golden: GoldenSetItem[] = [
      {
        eventId: "1",
        titleMatch: "Les règles du jeu",
        startAtMatch: "2026-11-28",
        label: "MAYBE",
      },
      {
        eventId: "2",
        titleMatch: "Les règles du jeu",
        startAtMatch: "2026-11-29",
        label: "MAYBE",
      },
    ];
    expect(
      matchGoldenItem(
        { title: "Les règles du jeu", startAt: "2026-11-28T20:30:00+01:00" },
        golden,
      )?.eventId,
    ).toBe("1");
    expect(
      matchGoldenItem(
        { title: "Les règles du jeu", startAt: "2026-11-29T15:00:00+01:00" },
        golden,
      )?.eventId,
    ).toBe("2");
  });

  it("matchGoldenItem : eventIds crédite l’unité canonique", () => {
    const golden: GoldenSetItem[] = [
      {
        eventId: "69569603",
        eventIds: ["69569603", "44494005"],
        titleMatch: "Les règles du jeu",
        radarLabel: "MAYBE",
      },
    ];
    expect(
      matchGoldenItem({ title: "x", eventId: "44494005" }, golden)?.eventId,
    ).toBe("69569603");
    expect(
      matchGoldenItem({ title: "Les règles du jeu" }, golden)?.eventId,
    ).toBe("69569603");
  });
});

describe("evaluateEditorialSnapshot", () => {
  it("produit recall / composition / slots sur une mini fixture", () => {
    const report = evaluateEditorialSnapshot({
      versionLabel: "fixture",
      golden: {
        version: 1,
        items: [
          { eventId: "m1", titleMatch: "Must One", label: "MUST" },
          { eventId: "m2", titleMatch: "Must Two", label: "MUST" },
          { eventId: "mb", titleMatch: "Maybe One", label: "MAYBE" },
          { eventId: "no1", titleMatch: "No One", label: "NO" },
        ],
      },
      snapshot: {
        highlights: [
          { title: "Must One", slot: "strong-event" },
          { title: "Maybe One", slot: "wildcard" },
          { title: "Unlabeled Event", slot: "easy-to-miss" },
          { title: "No One", slot: "worth-planning" },
        ],
        rows: [
          {
            title: "Must One",
            appeal: 4,
            missRisk: 2,
            planningNeed: 3,
            localRarity: 2,
            likelyDemand: 1,
            confidence: 0.7,
          },
          {
            title: "Must Two",
            appeal: 5,
            missRisk: 1,
            planningNeed: 4,
            localRarity: 3,
            likelyDemand: 0,
            confidence: 0.8,
          },
          {
            title: "Maybe One",
            appeal: 3,
            missRisk: 2,
            planningNeed: 1,
            localRarity: 1,
            likelyDemand: 0,
            confidence: 0.6,
          },
          {
            title: "No One",
            appeal: 2,
            missRisk: 1,
            planningNeed: 0,
            localRarity: 0,
            likelyDemand: 0,
            confidence: 0.5,
          },
          {
            title: "Unlabeled Event",
            appeal: 2,
            missRisk: 1,
            planningNeed: 1,
            localRarity: 0,
            likelyDemand: 0,
            confidence: 0.5,
          },
        ],
      },
    });

    expect(report.mustRecallAt10).toEqual({
      hit: 1,
      eligible: 2,
      recall: 0.5,
    });
    expect(report.precisionAt10).toMatchObject({
      must: 1,
      maybe: 1,
      no: 1,
      unlabeled: 1,
      unjudgeable: 0,
      score: 0.2,
    });
    expect(report.goldenHits.mustMissed).toContain("Must Two");
    expect(report.goldenHits.noSelected).toContain("No One");
    expect(report.goldenHits.maybeSelected).toContain("Maybe One");
  });

  it("exclut UNJUDGEABLE de l’IDCG et ne le compte pas comme NO", () => {
    const report = evaluateEditorialSnapshot({
      versionLabel: "unjudgeable",
      golden: {
        version: 2,
        items: [
          {
            eventId: "m1",
            titleMatch: "Must One",
            radarLabel: "MUST",
          },
          {
            eventId: "u1",
            titleMatch: "Chameau",
            radarLabel: "UNJUDGEABLE",
          },
        ],
      },
      snapshot: {
        highlights: [
          { title: "Must One", slot: "strong-event" },
          { title: "Chameau", slot: "wildcard" },
        ],
        rows: [
          { title: "Must One", appeal: 4 },
          { title: "Chameau", appeal: 3 },
          { title: "Other", appeal: 2 },
        ],
      },
    });

    expect(report.precisionAt10.unjudgeable).toBe(1);
    expect(report.precisionAt10.no).toBe(0);
    expect(report.labeledInCorpus).toBe(1);
    expect(report.goldenHits.noSelected).toEqual([]);
    // Ideal = [3] only — selecting MUST first then UNJUDGEABLE(0) is perfect for k=2 vs ideal [3]
    expect(report.ndcgAt10).toBeCloseTo(1, 8);
  });

  it("eventIds : deux occurrences = une unité IDCG / un crédit MAYBE", () => {
    const report = evaluateEditorialSnapshot({
      versionLabel: "dedup",
      golden: {
        version: 2,
        items: [
          {
            eventId: "69569603",
            eventIds: ["69569603", "44494005"],
            titleMatch: "Les règles du jeu",
            radarLabel: "MAYBE",
          },
          {
            eventId: "m1",
            titleMatch: "Must One",
            radarLabel: "MUST",
          },
        ],
      },
      snapshot: {
        highlights: [
          { title: "Must One", slot: "strong-event" },
          {
            title: "Les règles du jeu",
            startAt: "2026-11-28T20:30:00+01:00",
            slot: "easy-to-miss",
          },
        ],
        rows: [
          {
            title: "Les règles du jeu",
            startAt: "2026-11-28T20:30:00+01:00",
            eventId: "69569603",
          },
          {
            title: "Les règles du jeu",
            startAt: "2026-11-29T15:00:00+01:00",
            eventId: "44494005",
          },
          { title: "Must One", eventId: "m1" },
        ],
      },
    });

    expect(report.labeledInCorpus).toBe(2);
    expect(report.precisionAt10.maybe).toBe(1);
    expect(report.goldenHits.maybeSelected).toEqual(["Les règles du jeu"]);
  });
});
