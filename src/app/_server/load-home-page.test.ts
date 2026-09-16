import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const getCachedPublicHomeData = vi.fn();

vi.mock("@/infrastructure/next-public-home-cache", () => ({
  getCachedPublicHomeData: (...args: unknown[]) =>
    getCachedPublicHomeData(...args),
}));

vi.mock("@/infrastructure/db/home-perf", () => ({
  homePerfLog: vi.fn(),
  homePerfNextReqId: () => "test-req",
  homePerfTimed: async <T>(run: () => Promise<T>) => {
    const value = await run();
    return { value, ms: 1 };
  },
}));

describe("loadHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedPublicHomeData.mockResolvedValue({
      highlights: [{ id: "h1" }],
      planningEvents: [],
      explorer: { events: [{ id: "e1" }], totalCount: 1, nextCursor: null },
    });
  });

  it("ne charge que le read model public (pas auth / favoris)", async () => {
    const { loadHomePage } = await import("@/app/_server/load-home-page");
    const result = await loadHomePage();

    expect(getCachedPublicHomeData).toHaveBeenCalledTimes(1);
    expect(getCachedPublicHomeData).toHaveBeenCalledWith();
    expect(result).toEqual({
      highlights: [{ id: "h1" }],
      planningEvents: [],
      explorer: { events: [{ id: "e1" }], totalCount: 1, nextCursor: null },
      debugEvents: undefined,
      debugMeta: undefined,
    });
    expect(result).not.toHaveProperty("isAuthenticated");
    expect(result).not.toHaveProperty("favoriteEventIds");
    expect(result).not.toHaveProperty("accountLabel");
  });

  it("source : aucune dépendance headers / session / favoris", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/_server/load-home-page.ts"),
      "utf8",
    );
    expect(source).toContain("getCachedPublicHomeData");
    expect(source).not.toContain("getAccountAuthState");
    expect(source).not.toContain("listFavoriteEventIdsForUser");
    expect(source).not.toContain("headers");
    expect(source).not.toContain("getSession");
  });

  it("page `/` : revalidate ISR + pas d’auth dans le module page", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/page.tsx"),
      "utf8",
    );
    expect(source).toMatch(/export const revalidate = 21600/);
    expect(source).toContain("loadHomePage");
    expect(source).not.toContain("getAccountAuthState");
    expect(source).not.toContain("headers");
  });
});
