import { describe, expect, it } from "vitest";
import {
  clampScore,
  parseAiHighlightAssessments,
} from "@/infrastructure/ai/highlight-assessment-parser";

describe("parseAiHighlightAssessments", () => {
  it("parse une réponse JSON valide", () => {
    const result = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "a",
            appeal: 4,
            missRisk: 5,
            planningNeed: 3,
            localRarity: 4,
            likelyDemand: 3,
            confidence: 0.8,
            reasons: ["programmation locale peu visible mais intéressante"],
          },
        ],
      },
      ["a"],
    );

    expect(result).toEqual([
      {
        eventId: "a",
        appeal: 4,
        missRisk: 5,
        planningNeed: 3,
        localRarity: 4,
        likelyDemand: 3,
        confidence: 0.8,
        reasons: ["programmation locale peu visible mais intéressante"],
      },
    ]);
  });

  it("clamp les scores dans les bornes prévues", () => {
    expect(clampScore(9, 0, 5)).toBe(5);
    expect(clampScore(-2, 0, 5)).toBe(0);
    expect(clampScore(1.7, 0, 1)).toBe(1);
    expect(clampScore("nope", 0, 5)).toBe(0);

    const result = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "a",
            appeal: 99,
            missRisk: -3,
            planningNeed: "4",
            localRarity: 12,
            likelyDemand: -1,
            confidence: 2,
            reasons: ["ok"],
          },
        ],
      },
      ["a"],
    );

    expect(result[0]).toMatchObject({
      appeal: 5,
      missRisk: 0,
      planningNeed: 4,
      localRarity: 5,
      likelyDemand: 0,
      confidence: 1,
    });
  });

  it("dimensions absentes → défaut sûr (0)", () => {
    const result = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "a",
            appeal: 3,
            confidence: 0.5,
            reasons: [],
          },
        ],
      },
      ["a"],
    );

    expect(result[0]).toMatchObject({
      appeal: 3,
      missRisk: 0,
      planningNeed: 0,
      localRarity: 0,
      likelyDemand: 0,
      confidence: 0.5,
    });
  });

  it("clamp localRarity et likelyDemand <0 et >5", () => {
    const low = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "low",
            appeal: 1,
            missRisk: 1,
            planningNeed: 1,
            localRarity: -4,
            likelyDemand: -2,
            confidence: 0.1,
            reasons: [],
          },
        ],
      },
      ["low"],
    );
    const high = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "high",
            appeal: 1,
            missRisk: 1,
            planningNeed: 1,
            localRarity: 99,
            likelyDemand: 88,
            confidence: 0.1,
            reasons: [],
          },
        ],
      },
      ["high"],
    );

    expect(low[0]?.localRarity).toBe(0);
    expect(low[0]?.likelyDemand).toBe(0);
    expect(high[0]?.localRarity).toBe(5);
    expect(high[0]?.likelyDemand).toBe(5);
  });

  it("ignore un événement manquant dans la réponse", () => {
    const result = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "a",
            appeal: 3,
            missRisk: 3,
            planningNeed: 3,
            localRarity: 2,
            likelyDemand: 2,
            confidence: 0.5,
            reasons: [],
          },
        ],
      },
      ["a", "b"],
    );

    expect(result.map((item) => item.eventId)).toEqual(["a"]);
  });

  it("gère une réponse partielle / entrée invalide", () => {
    const result = parseAiHighlightAssessments(
      {
        assessments: [
          null,
          { eventId: "" },
          {
            eventId: "ok",
            appeal: 2,
            missRisk: 2,
            planningNeed: 2,
            localRarity: 1,
            likelyDemand: 1,
            confidence: 0.4,
            reasons: ["partiel"],
          },
          {
            eventId: "foreign",
            appeal: 5,
            missRisk: 5,
            planningNeed: 5,
            localRarity: 5,
            likelyDemand: 5,
            confidence: 1,
            reasons: [],
          },
        ],
      },
      ["ok"],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.eventId).toBe("ok");
    expect(result[0]?.localRarity).toBe(1);
  });

  it("accepte un tableau racine", () => {
    const result = parseAiHighlightAssessments(
      [
        {
          eventId: "a",
          appeal: 1,
          missRisk: 1,
          planningNeed: 1,
          localRarity: 0,
          likelyDemand: 0,
          confidence: 0.2,
          reasons: [],
        },
      ],
      ["a"],
    );
    expect(result).toHaveLength(1);
  });
});
