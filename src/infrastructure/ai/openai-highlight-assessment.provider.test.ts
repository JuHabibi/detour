import { describe, expect, it, vi } from "vitest";
import { OpenAiHighlightAssessmentProvider } from "@/infrastructure/ai/openai-highlight-assessment.provider";
import type { DetourEvent } from "@/domain/events/event";

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
                    missRisk: 3,
                    planningNeed: 5,
                    localRarity: 2,
                    likelyDemand: 4,
                    confidence: 0.7,
                    reasons: ["réservation anticipée probable"],
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
    expect(result[0]?.localRarity).toBe(2);
    expect(result[0]?.likelyDemand).toBe(4);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.messages[0].content).toContain("localRarity");
    expect(body.messages[0].content).toContain("missRisk");
    expect(body.messages[0].content).not.toContain("discoveryValue");
  });
});
