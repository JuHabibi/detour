import { describe, expect, it, vi } from "vitest";
import {
  clampScore,
  combinedAiScore,
  parseAiHighlightAssessments,
} from "@/domain/ai-highlight-assessment";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import { NoopHighlightAssessmentProvider } from "@/infrastructure/ai/noop-highlight-assessment.provider";
import { OpenAiHighlightAssessmentProvider } from "@/infrastructure/ai/openai-highlight-assessment.provider";
import type { DetourEvent } from "@/domain/event";

function event(id: string, title = "Titre"): DetourEvent {
  return {
    id,
    title,
    description: null,
    imageUrl: null,
    startAt: "2026-09-12T20:00:00+02:00",
    endAt: null,
    venue: null,
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    relevance: "culture",
  };
}

describe("parseAiHighlightAssessments", () => {
  it("parse une réponse JSON valide", () => {
    const result = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "a",
            appeal: 4,
            discoveryValue: 5,
            planningValue: 3,
            recognition: 4,
            confidence: 0.8,
            reasons: ["spectacle clair"],
          },
        ],
      },
      ["a"],
    );

    expect(result).toEqual([
      {
        eventId: "a",
        appeal: 4,
        discoveryValue: 5,
        planningValue: 3,
        recognition: 4,
        confidence: 0.8,
        reasons: ["spectacle clair"],
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
            discoveryValue: -3,
            planningValue: "4",
            recognition: 12,
            confidence: 2,
            reasons: ["ok"],
          },
        ],
      },
      ["a"],
    );

    expect(result[0]).toMatchObject({
      appeal: 5,
      discoveryValue: 0,
      planningValue: 4,
      recognition: 5,
      confidence: 1,
    });
  });

  it("recognition absente → défaut sûr (0)", () => {
    const result = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "a",
            appeal: 3,
            discoveryValue: 3,
            planningValue: 3,
            confidence: 0.5,
            reasons: [],
          },
        ],
      },
      ["a"],
    );

    expect(result[0]?.recognition).toBe(0);
    expect(result[0]).toMatchObject({
      appeal: 3,
      discoveryValue: 3,
      planningValue: 3,
      confidence: 0.5,
    });
  });

  it("clamp recognition <0 et >5", () => {
    const low = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "low",
            appeal: 1,
            discoveryValue: 1,
            planningValue: 1,
            recognition: -4,
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
            discoveryValue: 1,
            planningValue: 1,
            recognition: 99,
            confidence: 0.1,
            reasons: [],
          },
        ],
      },
      ["high"],
    );

    expect(low[0]?.recognition).toBe(0);
    expect(high[0]?.recognition).toBe(5);
  });

  it("ignore un événement manquant dans la réponse", () => {
    const result = parseAiHighlightAssessments(
      {
        assessments: [
          {
            eventId: "a",
            appeal: 3,
            discoveryValue: 3,
            planningValue: 3,
            recognition: 2,
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
            discoveryValue: 2,
            planningValue: 2,
            recognition: 1,
            confidence: 0.4,
            reasons: ["partiel"],
          },
          {
            eventId: "foreign",
            appeal: 5,
            discoveryValue: 5,
            planningValue: 5,
            recognition: 5,
            confidence: 1,
            reasons: [],
          },
        ],
      },
      ["ok"],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.eventId).toBe("ok");
    expect(result[0]?.recognition).toBe(1);
  });

  it("accepte un tableau racine", () => {
    const result = parseAiHighlightAssessments(
      [
        {
          eventId: "a",
          appeal: 1,
          discoveryValue: 1,
          planningValue: 1,
          recognition: 0,
          confidence: 0.2,
          reasons: [],
        },
      ],
      ["a"],
    );
    expect(result).toHaveLength(1);
  });
});

describe("combinedAiScore", () => {
  it("somme appeal + discovery + planning + recognition", () => {
    expect(
      combinedAiScore({
        eventId: "a",
        appeal: 4,
        discoveryValue: 5,
        planningValue: 3,
        recognition: 2,
        confidence: 0.9,
        reasons: [],
      }),
    ).toBe(14);
  });
});

describe("createHighlightAssessmentProvider", () => {
  it("fallback sans clé API → noop", () => {
    const provider = createHighlightAssessmentProvider({});
    expect(provider).toBeInstanceOf(NoopHighlightAssessmentProvider);
  });

  it("provider indisponible / noop renvoie []", async () => {
    const provider = new NoopHighlightAssessmentProvider();
    await expect(provider.assess([event("a")])).resolves.toEqual([]);
  });
});

describe("OpenAiHighlightAssessmentProvider", () => {
  it("erreur réseau / provider → throw (à catcher côté service)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.assess([event("a")])).rejects.toThrow("network down");
  });

  it("réponse HTTP d’erreur → throw", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.assess([event("a")])).rejects.toThrow(/500/);
  });

  it("parse le contenu JSON d’un batch réussi", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assessments: [
                  {
                    eventId: "a",
                    appeal: 4,
                    discoveryValue: 3,
                    planningValue: 5,
                    recognition: 2,
                    confidence: 0.7,
                    reasons: ["réservation anticipée"],
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      batchSize: 10,
    });

    const result = await provider.assess([event("a")]);
    expect(result).toHaveLength(1);
    expect(result[0]?.appeal).toBe(4);
    expect(result[0]?.recognition).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.messages[0].content).toContain("recognition");
  });
});
