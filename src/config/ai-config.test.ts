import { describe, expect, it } from "vitest";
import { getAiConfig } from "@/config/ai-config";
import {
  assessHighlightsCached,
  createMemoryAiAssessmentCacheStore,
} from "@/application/ai/ai-assessment-cache";
import {
  AI_ASSESSMENT_DEFAULT_MODEL,
  AI_ASSESSMENT_DEFAULT_TEMPERATURE,
  AI_ASSESSMENT_PROMPT_VERSION,
} from "@/infrastructure/ai/openai-highlight-assessment.provider";
import type { DetourEvent } from "@/domain/events/event";

function event(id: string): DetourEvent {
  return {
    id,
    title: `Title ${id}`,
    description: `Desc ${id}`,
    imageUrl: null,
    startAt: "2026-11-12T20:00:00+02:00",
    endAt: null,
    venue: "Salle",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: null,
    registrationUrl: null,
    relevance: "culture",
  };
}

const cacheContext = {
  model: AI_ASSESSMENT_DEFAULT_MODEL,
  promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
  generation: { temperature: AI_ASSESSMENT_DEFAULT_TEMPERATURE },
};

describe("getAiConfig", () => {
  it("DETOUR_AI_MODE explicite prime sur NODE_ENV", () => {
    expect(
      getAiConfig({
        NODE_ENV: "production",
        DETOUR_AI_MODE: "manual",
        DETOUR_AI_API_KEY: "sk-test",
      }),
    ).toMatchObject({ mode: "manual", enabled: true, displayMode: "manual" });
  });

  it("development → manual par défaut", () => {
    expect(
      getAiConfig({ NODE_ENV: "development", DETOUR_AI_API_KEY: "sk-test" }),
    ).toMatchObject({ mode: "manual", displayMode: "manual" });
  });

  it("production → auto par défaut", () => {
    expect(
      getAiConfig({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        DETOUR_AI_API_KEY: "sk-test",
      }),
    ).toMatchObject({ mode: "auto", displayMode: "auto" });
  });

  it("preview Vercel → manual par défaut", () => {
    expect(
      getAiConfig({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        DETOUR_AI_API_KEY: "sk-test",
      }),
    ).toMatchObject({ mode: "manual", displayMode: "manual" });
  });

  it("sans clé → disabled", () => {
    expect(getAiConfig({ NODE_ENV: "production" })).toMatchObject({
      enabled: false,
      displayMode: "disabled",
      mode: "auto",
    });
  });
});

describe("AI assessment cache (smoke)", () => {
  it("cache hit / force / fallback", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    let calls = 0;
    const assess = async () => {
      calls += 1;
      return [
        {
          eventId: "1",
          appeal: 3,
          missRisk: 3,
          planningNeed: 3,
          localRarity: 1,
          likelyDemand: 1,
          confidence: 0.5,
          reasons: ["ok"],
        },
      ];
    };

    const first = await assessHighlightsCached({
      events: [event("1")],
      assess,
      store,
      cacheContext,
    });
    expect(first.source).toBe("fresh");
    expect(calls).toBe(1);

    const second = await assessHighlightsCached({
      events: [event("1")],
      assess,
      store,
      cacheContext,
    });
    expect(second.source).toBe("cache");
    expect(calls).toBe(1);

    const forced = await assessHighlightsCached({
      events: [event("1")],
      assess,
      store,
      cacheContext,
      force: true,
    });
    expect(forced.source).toBe("fresh");
    expect(calls).toBe(2);

    const failed = await assessHighlightsCached({
      events: [event("1")],
      assess: async () => {
        throw new Error("boom");
      },
      store: createMemoryAiAssessmentCacheStore(),
      cacheContext,
    });
    expect(failed.source).toBe("fallback");
    expect(failed.assessments).toEqual([]);
  });
});
