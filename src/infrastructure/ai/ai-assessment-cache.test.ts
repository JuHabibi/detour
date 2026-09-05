import { describe, expect, it, vi } from "vitest";
import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/event";
import {
  AI_DETOUR_DEFAULT_LIMIT,
  selectAiDetourHighlights,
} from "@/domain/select-ai-detour-highlights";
import type { EventHighlight } from "@/domain/select-detour-highlights";
import {
  assessHighlightsCached,
  createMemoryAiAssessmentCacheStore,
  type AiAssessmentCacheContext,
  type AiAssessmentCacheEntry,
} from "@/infrastructure/ai/ai-assessment-cache";
import {
  AI_ASSESSMENT_DEFAULT_MODEL,
  AI_ASSESSMENT_DEFAULT_TEMPERATURE,
  AI_ASSESSMENT_PROMPT_VERSION,
} from "@/infrastructure/ai/openai-highlight-assessment.provider";

function event(id: string, title = `Title ${id}`): DetourEvent {
  return {
    id,
    title,
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

function assessment(
  eventId: string,
  appeal = 3,
): AiHighlightAssessment {
  return {
    eventId,
    appeal,
    missRisk: 3,
    planningNeed: 3,
    localRarity: 2,
    likelyDemand: 2,
    confidence: 0.8,
    reasons: ["ok"],
  };
}

const baseContext: AiAssessmentCacheContext = {
  model: AI_ASSESSMENT_DEFAULT_MODEL,
  promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
  generation: { temperature: AI_ASSESSMENT_DEFAULT_TEMPERATURE },
};

function candidate(e: DetourEvent): EventHighlight {
  return {
    event: e,
    score: 5,
    planningScore: 1,
    reasons: ["high-appeal"],
  };
}

describe("assessHighlightsCached per-event", () => {
  it("total hit → 0 nouvel appel provider", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );

    const first = await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });
    expect(first.source).toBe("fresh");
    expect(first.cacheHits).toBe(0);
    expect(first.cacheMisses).toBe(2);
    expect(assess).toHaveBeenCalledTimes(1);

    const second = await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });
    expect(second.source).toBe("cache");
    expect(second.cacheHits).toBe(2);
    expect(second.cacheMisses).toBe(0);
    expect(assess).toHaveBeenCalledTimes(1);
    expect(second.assessments.map((item) => item.eventId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("1 event modifié → miss uniquement sur cet event", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id, item.title.includes("new") ? 5 : 3)),
    );

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });

    const result = await assessHighlightsCached({
      events: [event("a"), event("b", "Title b new")],
      assess,
      store,
      cacheContext: baseContext,
    });

    expect(assess).toHaveBeenCalledTimes(2);
    const secondCall = assess.mock.calls[1]?.[0] as DetourEvent[];
    expect(secondCall.map((item) => item.id)).toEqual(["b"]);
    expect(result.cacheHits).toBe(1);
    expect(result.cacheMisses).toBe(1);
    expect(result.source).toBe("partial");
    expect(result.assessments.find((item) => item.eventId === "a")?.appeal).toBe(
      3,
    );
    expect(result.assessments.find((item) => item.eventId === "b")?.appeal).toBe(
      5,
    );
  });

  it("1 event ajouté → miss uniquement sur le nouveau", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });

    const result = await assessHighlightsCached({
      events: [event("a"), event("b"), event("c")],
      assess,
      store,
      cacheContext: baseContext,
    });

    expect(assess).toHaveBeenCalledTimes(2);
    expect((assess.mock.calls[1]?.[0] as DetourEvent[]).map((e) => e.id)).toEqual([
      "c",
    ]);
    expect(result.cacheHits).toBe(2);
    expect(result.cacheMisses).toBe(1);
    expect(result.assessments).toHaveLength(3);
  });

  it("réordonnancement seul → 0 miss", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });

    const result = await assessHighlightsCached({
      events: [event("b"), event("a")],
      assess,
      store,
      cacheContext: baseContext,
    });

    expect(assess).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("cache");
    expect(result.cacheMisses).toBe(0);
    expect(result.assessments.map((item) => item.eventId)).toEqual([
      "b",
      "a",
    ]);
  });

  it("bump model / promptVersion → misses", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );

    await assessHighlightsCached({
      events: [event("a")],
      assess,
      store,
      cacheContext: baseContext,
    });

    await assessHighlightsCached({
      events: [event("a")],
      assess,
      store,
      cacheContext: { ...baseContext, model: "gpt-4o" },
    });
    await assessHighlightsCached({
      events: [event("a")],
      assess,
      store,
      cacheContext: {
        ...baseContext,
        promptVersion: "detour-ai-assess-v999",
      },
    });

    expect(assess).toHaveBeenCalledTimes(3);
  });

  it("force → bypass + reassessment complet", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const invalidate = vi.fn();
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });

    const forced = await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
      force: true,
      onForceInvalidate: invalidate,
    });

    expect(assess).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(forced.source).toBe("fresh");
    expect(forced.cacheMisses).toBe(2);
  });

  it("provider omet 1 id → pas de cache pour cet id, retry ensuite", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    let calls = 0;
    const assess = vi.fn(async (events: DetourEvent[]) => {
      calls += 1;
      if (calls === 1) {
        return events
          .filter((item) => item.id !== "b")
          .map((item) => assessment(item.id));
      }
      return events.map((item) => assessment(item.id, 4));
    });

    const first = await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });
    expect(first.assessments.map((item) => item.eventId)).toEqual(["a"]);
    expect(first.source).toBe("partial");

    const second = await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });
    expect(second.cacheHits).toBe(1);
    expect(second.cacheMisses).toBe(1);
    expect((assess.mock.calls[1]?.[0] as DetourEvent[]).map((e) => e.id)).toEqual([
      "b",
    ]);
    expect(second.assessments.map((item) => item.eventId).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("provider throw avec cached → partial, conserve cached", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const assess = vi
      .fn()
      .mockImplementationOnce(async (events: DetourEvent[]) =>
        events.map((item) => assessment(item.id)),
      )
      .mockRejectedValueOnce(new Error("down"));

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
    });

    const result = await assessHighlightsCached({
      events: [event("a"), event("b"), event("c")],
      assess,
      store,
      cacheContext: baseContext,
    });

    expect(result.source).toBe("partial");
    expect(result.assessments.map((item) => item.eventId).sort()).toEqual([
      "a",
      "b",
    ]);
    expect(result.cacheHits).toBe(2);
    expect(result.cacheMisses).toBe(1);
  });

  it("provider throw sans cached → fallback", async () => {
    const result = await assessHighlightsCached({
      events: [event("a")],
      assess: async () => {
        throw new Error("down");
      },
      store: createMemoryAiAssessmentCacheStore(),
      cacheContext: baseContext,
    });

    expect(result.source).toBe("fallback");
    expect(result.assessments).toEqual([]);
  });

  it("mêmes assessments mergés → même top10 selector", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const events = [event("a"), event("b"), event("c")];
    const assess = vi.fn(async (input: DetourEvent[]) =>
      input.map((item, index) => assessment(item.id, 5 - index)),
    );

    const first = await assessHighlightsCached({
      events,
      assess,
      store,
      cacheContext: baseContext,
    });
    const second = await assessHighlightsCached({
      events: [events[2]!, events[0]!, events[1]!],
      assess,
      store,
      cacheContext: baseContext,
    });

    const candidates = events.map(candidate);
    const topA = selectAiDetourHighlights(candidates, first.assessments, {
      limit: AI_DETOUR_DEFAULT_LIMIT,
    }).map((item) => item.event.id);
    const topB = selectAiDetourHighlights(candidates, second.assessments, {
      limit: AI_DETOUR_DEFAULT_LIMIT,
    }).map((item) => item.event.id);

    expect(topA).toEqual(topB);
    expect(assess).toHaveBeenCalledTimes(1);
  });

  it("readThrough peuplé après batch sans N appels API", async () => {
    const store = createMemoryAiAssessmentCacheStore();
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );
    const readThrough = vi.fn(
      async (
        _key: string,
        compute: () => Promise<AiAssessmentCacheEntry>,
      ) => compute(),
    );

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store,
      cacheContext: baseContext,
      readThrough,
    });

    expect(assess).toHaveBeenCalledTimes(1);
    expect(readThrough).toHaveBeenCalledTimes(2);
  });

  it("readThrough : seuls les vrais misses Next partent au provider", async () => {
    const { buildAiAssessmentEventCacheKey } = await import(
      "@/infrastructure/ai/ai-assessment-cache-key"
    );

    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );

    const keyOf = (id: string) =>
      buildAiAssessmentEventCacheKey({
        event: event(id),
        model: baseContext.model,
        promptVersion: baseContext.promptVersion,
        generation: baseContext.generation,
      });

    const nextStore = new Map<string, AiAssessmentCacheEntry>([
      [
        keyOf("a"),
        { assessment: assessment("a"), assessedAt: "2026-01-01T00:00:00.000Z" },
      ],
      [
        keyOf("b"),
        { assessment: assessment("b"), assessedAt: "2026-01-01T00:00:00.000Z" },
      ],
    ]);

    const readThrough = vi.fn(
      async (
        key: string,
        compute: () => Promise<AiAssessmentCacheEntry>,
      ) => {
        const hit = nextStore.get(key);
        if (hit) return hit;
        const entry = await compute();
        nextStore.set(key, entry);
        return entry;
      },
    );

    const result = await assessHighlightsCached({
      events: [event("a"), event("b"), event("c")],
      assess,
      store: createMemoryAiAssessmentCacheStore(),
      cacheContext: baseContext,
      readThrough,
    });

    expect(assess).toHaveBeenCalledTimes(1);
    expect((assess.mock.calls[0]?.[0] as DetourEvent[]).map((e) => e.id)).toEqual([
      "c",
    ]);
    expect(result.assessments.map((item) => item.eventId).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(result.cacheHits).toBe(2);
    expect(result.cacheMisses).toBe(1);
    expect(result.source).toBe("partial");
  });

  it("full Next hit après cold start → hits=N, misses=0, source=cache", async () => {
    const assess = vi.fn(async (events: DetourEvent[]) =>
      events.map((item) => assessment(item.id)),
    );
    const nextStore = new Map<string, AiAssessmentCacheEntry>();
    const readThrough = async (
      key: string,
      compute: () => Promise<AiAssessmentCacheEntry>,
    ) => {
      const hit = nextStore.get(key);
      if (hit) return hit;
      const entry = await compute();
      nextStore.set(key, entry);
      return entry;
    };

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store: createMemoryAiAssessmentCacheStore(),
      cacheContext: baseContext,
      readThrough,
    });
    assess.mockClear();

    const result = await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store: createMemoryAiAssessmentCacheStore(),
      cacheContext: baseContext,
      readThrough,
    });

    expect(assess).not.toHaveBeenCalled();
    expect(result.cacheHits).toBe(2);
    expect(result.cacheMisses).toBe(0);
    expect(result.source).toBe("cache");
  });

  it("Next hits + provider failure sur miss → partial, conserve hits", async () => {
    const assess = vi
      .fn()
      .mockImplementationOnce(async (events: DetourEvent[]) =>
        events.map((item) => assessment(item.id)),
      )
      .mockRejectedValueOnce(new Error("down"));

    const nextStore = new Map<string, AiAssessmentCacheEntry>();
    const readThrough = async (
      key: string,
      compute: () => Promise<AiAssessmentCacheEntry>,
    ) => {
      const hit = nextStore.get(key);
      if (hit) return hit;
      const entry = await compute();
      nextStore.set(key, entry);
      return entry;
    };

    await assessHighlightsCached({
      events: [event("a"), event("b")],
      assess,
      store: createMemoryAiAssessmentCacheStore(),
      cacheContext: baseContext,
      readThrough,
    });

    const result = await assessHighlightsCached({
      events: [event("a"), event("b"), event("c")],
      assess,
      store: createMemoryAiAssessmentCacheStore(),
      cacheContext: baseContext,
      readThrough,
    });

    expect(result.source).toBe("partial");
    expect(result.assessments.map((item) => item.eventId).sort()).toEqual([
      "a",
      "b",
    ]);
    expect(result.cacheHits).toBe(2);
    expect(result.cacheMisses).toBe(1);
  });
});
