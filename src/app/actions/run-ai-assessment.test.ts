import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  runManualAiAssessment,
  EventServiceMock,
  getAiConfig,
  createHomeEventSource,
  createHighlightAssessmentProvider,
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
} = vi.hoisted(() => {
  const runManualAiAssessment = vi.fn();
  return {
    runManualAiAssessment,
    EventServiceMock: vi.fn(function EventService() {
      return { runManualAiAssessment };
    }),
    getAiConfig: vi.fn(),
    createHomeEventSource: vi.fn(() => ({ kind: "source" })),
    createHighlightAssessmentProvider: vi.fn(() => ({ kind: "provider" })),
    createNextAiAssessmentReadThrough: vi.fn(() => ({ kind: "readThrough" })),
    invalidateNextAiAssessmentCache: vi.fn(),
  };
});

vi.mock("@/config/ai-config", () => ({
  getAiConfig,
}));

vi.mock("@/application/event.service", () => ({
  EventService: EventServiceMock,
}));

vi.mock("@/infrastructure/create-detour-event-source", () => ({
  createHomeEventSource,
}));

vi.mock("@/infrastructure/ai/create-highlight-assessment-provider", () => ({
  createHighlightAssessmentProvider,
}));

vi.mock("@/infrastructure/ai/next-ai-assessment-cache", () => ({
  createNextAiAssessmentReadThrough,
  invalidateNextAiAssessmentCache,
}));

vi.mock("@/application/build-events-debug-meta", () => ({
  buildEventsDebugMeta: vi.fn(() => ({ mocked: true })),
}));

vi.mock("@/application/map-detour-event-to-ui", () => ({
  mapDetourHighlightToEventItem: vi.fn((h: { event: { id: string } }) => ({
    id: h.event.id,
    title: "Highlight",
  })),
  mapDetourEventToEventItem: vi.fn((e: { id: string }) => ({
    id: e.id,
    title: "Planning",
  })),
}));

import { runAiHighlightAssessment } from "@/app/actions/run-ai-assessment";

describe("runAiHighlightAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiConfig.mockReturnValue({
      enabled: true,
      mode: "manual",
      displayMode: "manual",
    });
    runManualAiAssessment.mockResolvedValue({
      highlights: [{ event: { id: "h1" } }],
      planningEvents: [{ event: { id: "p1" } }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuse en production même avec clé IA, mode manual et force — sans calcul ni invalidation", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const result = await runAiHighlightAssessment({ force: true });

    expect(result).toEqual({
      ok: false,
      error: "Run AI assessment réservé au développement local.",
    });
    expect(getAiConfig).not.toHaveBeenCalled();
    expect(EventServiceMock).not.toHaveBeenCalled();
    expect(createHomeEventSource).not.toHaveBeenCalled();
    expect(createHighlightAssessmentProvider).not.toHaveBeenCalled();
    expect(createNextAiAssessmentReadThrough).not.toHaveBeenCalled();
    expect(invalidateNextAiAssessmentCache).not.toHaveBeenCalled();
    expect(runManualAiAssessment).not.toHaveBeenCalled();
  });

  it("autorise le lancement en développement (mode manual + clé)", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const result = await runAiHighlightAssessment({ force: true });

    expect(result.ok).toBe(true);
    expect(getAiConfig).toHaveBeenCalled();
    expect(EventServiceMock).toHaveBeenCalled();
    expect(runManualAiAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
  });
});
