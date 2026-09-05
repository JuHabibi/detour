import { describe, expect, it, vi } from "vitest";
import { EventService } from "@/application/event.service";
import type { AiConfig } from "@/config/ai-config";
import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";
import { createMemoryAiAssessmentCacheStore } from "@/infrastructure/ai/ai-assessment-cache";

function event(id: string, title?: string): DetourEvent {
  return {
    id,
    title: title ?? `Spectacle avec Alice Moreau ${id}`,
    description: `Soirée avec Alice Moreau ${id}.`.padEnd(90, "."),
    imageUrl: null,
    startAt: "2026-11-12T20:00:00+02:00",
    endAt: null,
    venue: "MJC",
    city: "Olivet",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: "https://example.com",
    registrationUrl: "https://example.com/book",
    relevance: "culture",
  };
}

const autoConfig: AiConfig = {
  enabled: true,
  mode: "auto",
  displayMode: "auto",
};

const manualConfig: AiConfig = {
  enabled: true,
  mode: "manual",
  displayMode: "manual",
};

const disabledConfig: AiConfig = {
  enabled: false,
  mode: "auto",
  displayMode: "disabled",
};

function mockAssessments(): HighlightAssessmentProvider {
  return {
    assess: vi.fn().mockImplementation(async (input: DetourEvent[]) =>
      input.map((item) => {
        if (item.id === "star") {
          return {
            eventId: "star",
            appeal: 5,
            missRisk: 2,
            localRarity: 0,
            planningNeed: 2,
            likelyDemand: 5,
            confidence: 0.9,
            reasons: ["connu"],
          };
        }
        if (item.id === "gem") {
          return {
            eventId: "gem",
            appeal: 4,
            missRisk: 5,
            localRarity: 0,
            planningNeed: 1,
            likelyDemand: 0,
            confidence: 0.8,
            reasons: ["local"],
          };
        }
        if (item.id === "plan") {
          return {
            eventId: "plan",
            appeal: 3,
            missRisk: 2,
            localRarity: 0,
            planningNeed: 5,
            likelyDemand: 2,
            confidence: 0.8,
            reasons: ["anticiper"],
          };
        }
        return {
          eventId: item.id,
          appeal: 3,
          missRisk: 3,
          localRarity: 0,
          planningNeed: 3,
          likelyDemand: 1,
          confidence: 0.7,
          reasons: ["ok"],
        };
      }),
    ),
  };
}

describe("EventService AI mode + cache", () => {
  it("manual mode → aucun appel IA automatique", async () => {
    const assessor = mockAssessments();
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [event("a"), event("b")],
    };

    const result = await new EventService(source, assessor, {
      aiConfig: manualConfig,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    }).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(assessor.assess).not.toHaveBeenCalled();
    expect(result.aiAssessments).toEqual([]);
    expect(result.aiMeta.source).toBe("fallback");
    expect(
      result.highlights.every((item) => item.selectionSource === "deterministic"),
    ).toBe(true);
  });

  it("auto mode → assessment automatique + slots IA", async () => {
    const events = [
      event("star", "Grande tête d’affiche"),
      event("gem", "Découverte locale"),
      event("plan", "À noter tôt"),
      event("wild", "Wildcard culturel"),
    ];
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => events,
    };
    const assessor = mockAssessments();

    const result = await new EventService(source, assessor, {
      aiConfig: autoConfig,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    }).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(assessor.assess).toHaveBeenCalled();
    expect(result.aiMeta.source).toBe("fresh");
    expect(result.highlights.every((item) => item.selectionSource === "ai")).toBe(
      true,
    );
    expect(result.highlights.find((item) => item.slot === "strong-event")?.event.id).toBe(
      "star",
    );
  });

  it("auto mode sans clé (disabled) → fallback déterministe, 0 appel", async () => {
    const assessor = mockAssessments();
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [event("a"), event("b")],
    };

    const result = await new EventService(source, assessor, {
      aiConfig: disabledConfig,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    }).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(assessor.assess).not.toHaveBeenCalled();
    expect(result.aiMeta.displayMode).toBe("disabled");
    expect(result.aiMeta.source).toBe("fallback");
    expect(
      result.highlights.every((item) => item.selectionSource === "deterministic"),
    ).toBe(true);
  });

  it("erreur provider → fallback déterministe", async () => {
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [event("a"), event("b")],
    };
    const assessor: HighlightAssessmentProvider = {
      assess: vi.fn().mockRejectedValue(new Error("provider down")),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await new EventService(source, assessor, {
      aiConfig: autoConfig,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    }).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(result.highlights.length).toBeGreaterThan(0);
    expect(result.aiAssessments).toEqual([]);
    expect(result.aiMeta.source).toBe("fallback");
    expect(
      result.highlights.every((item) => item.selectionSource === "deterministic"),
    ).toBe(true);
    errorSpy.mockRestore();
  });

  it("cache hit → aucun nouvel appel provider", async () => {
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [event("a"), event("b")],
    };
    const assessor = mockAssessments();
    const cacheStore = createMemoryAiAssessmentCacheStore();
    const service = new EventService(source, assessor, {
      aiConfig: autoConfig,
      cacheStore,
    });

    await service.getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });
    await service.getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(assessor.assess).toHaveBeenCalledTimes(1);
  });

  it("event ajouté → nouvel appel uniquement pour le miss", async () => {
    let payload = [event("a"), event("b")];
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => payload,
    };
    const assessor = mockAssessments();
    const cacheStore = createMemoryAiAssessmentCacheStore();
    const service = new EventService(source, assessor, {
      aiConfig: autoConfig,
      cacheStore,
    });

    await service.getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    payload = [event("a"), event("b"), event("c")];
    await service.getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(assessor.assess).toHaveBeenCalledTimes(2);
    const secondArg = (assessor.assess as ReturnType<typeof vi.fn>).mock
      .calls[1]?.[0] as DetourEvent[];
    expect(secondArg.map((item) => item.id)).toEqual(["c"]);
  });

  it("force refresh / re-run → nouvel appel provider", async () => {
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [event("a"), event("b")],
    };
    const assessor = mockAssessments();
    const cacheStore = createMemoryAiAssessmentCacheStore();
    const service = new EventService(source, assessor, {
      aiConfig: manualConfig,
      cacheStore,
    });

    await service.runManualAiAssessment({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
      force: false,
    });
    await service.runManualAiAssessment({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
      force: false,
    });
    expect(assessor.assess).toHaveBeenCalledTimes(1);

    await service.runManualAiAssessment({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
      force: true,
    });
    expect(assessor.assess).toHaveBeenCalledTimes(2);
  });
});

describe("EventService fraîcheur (encore actif)", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  it("event terminé exclu des events et highlights", async () => {
    const ended = event("ended", "Spectacle terminé Alice Moreau");
    ended.startAt = "2026-09-01T10:00:00.000Z";
    ended.endAt = "2026-09-05T11:00:00.000Z";

    const active = event("active", "Spectacle actif Alice Moreau");
    active.startAt = "2026-10-01T20:00:00.000Z";
    active.endAt = null;

    const result = await new EventService(
      { fetchUpcomingEvents: async () => [ended, active] },
      mockAssessments(),
      { aiConfig: manualConfig, cacheStore: createMemoryAiAssessmentCacheStore() },
    ).getUpcomingEvents({
      from: now,
      to: new Date("2027-03-01T00:00:00.000Z"),
    });

    expect(result.events.map((item) => item.id)).toEqual(["active"]);
    expect(result.highlights.every((item) => item.event.id !== "ended")).toBe(
      true,
    );
    expect(result.highlights.some((item) => item.event.id === "active")).toBe(
      true,
    );
  });

  it("event commencé mais encore en cours reste sélectionnable", async () => {
    const ongoing = event("ongoing", "Festival en cours Alice Moreau");
    ongoing.startAt = "2026-09-01T10:00:00.000Z";
    ongoing.endAt = "2026-09-10T18:00:00.000Z";

    const result = await new EventService(
      { fetchUpcomingEvents: async () => [ongoing] },
      mockAssessments(),
      { aiConfig: manualConfig, cacheStore: createMemoryAiAssessmentCacheStore() },
    ).getUpcomingEvents({
      from: now,
      to: new Date("2027-03-01T00:00:00.000Z"),
    });

    expect(result.events.map((item) => item.id)).toEqual(["ongoing"]);
    expect(result.highlights.some((item) => item.event.id === "ongoing")).toBe(
      true,
    );
  });
});
