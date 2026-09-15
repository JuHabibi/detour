import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedPublicHomeData = vi.fn();
const getAccountAuthState = vi.fn();
const listFavoriteEventIdsForUser = vi.fn();

vi.mock("@/infrastructure/next-public-home-cache", () => ({
  getCachedPublicHomeData: (...args: unknown[]) =>
    getCachedPublicHomeData(...args),
}));

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: (...args: unknown[]) => getAccountAuthState(...args),
}));

vi.mock("@/infrastructure/db/favorite.repository", () => ({
  listFavoriteEventIdsForUser: (...args: unknown[]) =>
    listFavoriteEventIdsForUser(...args),
}));

vi.mock("@/infrastructure/db/home-perf", () => ({
  homePerfLog: vi.fn(),
  homePerfNextReqId: () => "test-req",
  homePerfPoolMeta: () => ({ poolCreateMs: null, poolAgeMs: null }),
  homePerfProcessAgeMs: () => 10_000,
  homePerfTimed: async <T>(run: () => Promise<T>) => {
    const value = await run();
    return { value, ms: 1 };
  },
  homePerfWithAuthDbProbe: async <T>(run: () => Promise<T>) => {
    const value = await run();
    return { value, dbMs: 0, dbQueries: 0 };
  },
  homePerfNoteAuthDbQuery: vi.fn(),
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

  it("anonyme : public cache + auth, pas de favoris", async () => {
    getAccountAuthState.mockResolvedValue({ status: "unauthenticated" });

    const { loadHomePage } = await import("@/app/_server/load-home-page");
    const result = await loadHomePage();

    expect(getCachedPublicHomeData).toHaveBeenCalledTimes(1);
    expect(getCachedPublicHomeData).toHaveBeenCalledWith();
    expect(listFavoriteEventIdsForUser).not.toHaveBeenCalled();
    expect(result.isAuthenticated).toBe(false);
    expect(result.favoriteEventIds).toEqual([]);
    expect(result.accountLabel).toBe("Se connecter");
    expect(result.highlights).toEqual([{ id: "h1" }]);
  });

  it("authentifié : favoris scopés user, hors appel cache public", async () => {
    getAccountAuthState.mockResolvedValue({
      status: "authenticated",
      user: { id: "user-a", email: "a@example.com", name: "A" },
    });
    listFavoriteEventIdsForUser.mockResolvedValue(["fav-1"]);

    const { loadHomePage } = await import("@/app/_server/load-home-page");
    const result = await loadHomePage();

    expect(getCachedPublicHomeData).toHaveBeenCalledWith();
    expect(listFavoriteEventIdsForUser).toHaveBeenCalledWith("user-a");
    expect(result.favoriteEventIds).toEqual(["fav-1"]);
    expect(result.accountLabel).toBe("Mon compte");
    expect(result.isAuthenticated).toBe(true);
  });

  it("deux users : favoris ne fuient pas dans le cache public", async () => {
    const { loadHomePage } = await import("@/app/_server/load-home-page");

    getAccountAuthState.mockResolvedValue({
      status: "authenticated",
      user: { id: "user-a", email: "a@example.com", name: "A" },
    });
    listFavoriteEventIdsForUser.mockResolvedValue(["only-a"]);
    const a = await loadHomePage();

    getAccountAuthState.mockResolvedValue({
      status: "authenticated",
      user: { id: "user-b", email: "b@example.com", name: "B" },
    });
    listFavoriteEventIdsForUser.mockResolvedValue(["only-b"]);
    const b = await loadHomePage();

    expect(a.favoriteEventIds).toEqual(["only-a"]);
    expect(b.favoriteEventIds).toEqual(["only-b"]);
    expect(getCachedPublicHomeData.mock.calls.every((c) => c.length === 0)).toBe(
      true,
    );
  });
});
