import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Régression : importer le vrai module cache Explorer (graphe réel)
 * ne doit pas initialiser les factories Home/Radar ni IA.
 * On instrumente les factories ; on ne mocke pas `next-public-home-cache`.
 */
const { createHomeEventSource, createHighlightAssessmentProvider } = vi.hoisted(
  () => ({
    createHomeEventSource: vi.fn(() => ({ kind: "instrumented-source" })),
    createHighlightAssessmentProvider: vi.fn(() => ({
      kind: "instrumented-provider",
    })),
  }),
);

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (compute: () => Promise<unknown>) => {
    const run = async () => compute();
    return run;
  },
}));

vi.mock("@/infrastructure/create-detour-event-source", () => ({
  createHomeEventSource: () => createHomeEventSource(),
}));

vi.mock("@/infrastructure/ai/create-highlight-assessment-provider", () => ({
  createHighlightAssessmentProvider: () => createHighlightAssessmentProvider(),
}));

describe("next-public-explorer-cache — découplage Home", () => {
  beforeEach(() => {
    vi.resetModules();
    createHomeEventSource.mockClear();
    createHighlightAssessmentProvider.mockClear();
  });

  it("l’import réel du cache Explorer n’initialise pas Radar / IA", async () => {
    const explorerCache = await import(
      "@/infrastructure/next-public-explorer-cache"
    );

    expect(explorerCache.PUBLIC_EXPLORER_CACHE_TAG).toBe(
      "public-explorer:orleans",
    );
    expect(createHomeEventSource).not.toHaveBeenCalled();
    expect(createHighlightAssessmentProvider).not.toHaveBeenCalled();

    // Contrôle positif : charger le read model Home initialise bien les factories.
    await import("@/application/home/get-public-home-data");
    expect(createHomeEventSource).toHaveBeenCalled();
    expect(createHighlightAssessmentProvider).toHaveBeenCalled();
  });
});
