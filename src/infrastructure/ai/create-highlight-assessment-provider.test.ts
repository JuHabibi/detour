import { describe, expect, it } from "vitest";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import { NoopHighlightAssessmentProvider } from "@/infrastructure/ai/noop-highlight-assessment.provider";
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
