import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedPublicExplorerInitialPage = vi.fn();

vi.mock("@/infrastructure/next-public-explorer-cache", () => ({
  getCachedPublicExplorerInitialPage: (...args: unknown[]) =>
    getCachedPublicExplorerInitialPage(...args),
}));

describe("loadExplorerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedPublicExplorerInitialPage.mockResolvedValue({
      events: [{ id: "e1" }],
      totalCount: 3,
      nextCursor: "cursor-1",
    });
  });

  it("ne charge que la première page Explorer publique (pas auth / favoris / Radar)", async () => {
    const { loadExplorerPage } = await import("@/app/_server/load-explorer-page");
    const result = await loadExplorerPage();

    expect(getCachedPublicExplorerInitialPage).toHaveBeenCalledTimes(1);
    expect(getCachedPublicExplorerInitialPage).toHaveBeenCalledWith();
    expect(result).toEqual({
      explorer: {
        events: [{ id: "e1" }],
        totalCount: 3,
        nextCursor: "cursor-1",
      },
    });
    expect(result).not.toHaveProperty("highlights");
    expect(result).not.toHaveProperty("isAuthenticated");
  });
});
