import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
const unstable_cache = vi.fn(
  (compute: () => Promise<unknown>, _key: unknown, options: unknown) => {
    const run = async () => compute();
    (run as { __options?: unknown }).__options = options;
    (run as { __key?: unknown }).__key = _key;
    return run;
  },
);

vi.mock("next/cache", () => ({
  revalidateTag,
  unstable_cache,
}));

const getPublicHomeSnapshot = vi.fn();
const materializePublicHomeData = vi.fn();

vi.mock("@/application/home/get-public-home-data", () => ({
  getPublicHomeSnapshot: (...args: unknown[]) => getPublicHomeSnapshot(...args),
  materializePublicHomeData: (...args: unknown[]) =>
    materializePublicHomeData(...args),
  publicHomeUpcomingWindow: () => ({
    from: new Date("2026-09-15T10:00:00.000Z"),
    to: new Date("2026-03-14T10:00:00.000Z"),
  }),
}));

vi.mock("@/config/home-debug", () => ({
  shouldExposeHomeDebug: () => false,
}));

vi.mock("@/infrastructure/db/home-perf", () => ({
  homePerfLog: vi.fn(),
}));

describe("next-public-home-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicHomeSnapshot.mockResolvedValue({
      pipeline: { events: [] },
      explorerPage: { events: [], totalCount: 0, nextCursor: null },
      exposeDebug: false,
    });
    materializePublicHomeData.mockResolvedValue({
      highlights: [],
      planningEvents: [],
      explorer: { events: [], totalCount: 0, nextCursor: null },
    });
  });

  it("tag scope territoire futur-proof public-home:orleans", async () => {
    const {
      PUBLIC_HOME_CACHE_TAG,
      PUBLIC_HOME_TERRITORY_SLUG,
      invalidatePublicHomeCache,
    } = await import("@/infrastructure/next-public-home-cache");

    expect(PUBLIC_HOME_TERRITORY_SLUG).toBe("orleans");
    expect(PUBLIC_HOME_CACHE_TAG).toBe("public-home:orleans");

    invalidatePublicHomeCache();
    expect(revalidateTag).toHaveBeenCalledWith("public-home:orleans", {
      expire: 0,
    });
  });

  it("getCachedPublicHomeData n’accepte pas de userId et wrap unstable_cache + tag", async () => {
    const { getCachedPublicHomeData, PUBLIC_HOME_CACHE_TAG } = await import(
      "@/infrastructure/next-public-home-cache"
    );

    expect(getCachedPublicHomeData.length).toBe(0);

    await getCachedPublicHomeData();

    expect(unstable_cache).toHaveBeenCalledTimes(1);
    const [, keyParts, options] = unstable_cache.mock.calls[0]!;
    expect(keyParts).toEqual([
      "detour-public-home",
      "orleans",
      "pre-ai-snapshot-slim-v1",
    ]);
    expect(options).toMatchObject({
      tags: [PUBLIC_HOME_CACHE_TAG],
    });
    expect(getPublicHomeSnapshot).toHaveBeenCalledTimes(1);
    const callArg = getPublicHomeSnapshot.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(callArg).not.toHaveProperty("userId");
    expect(callArg).not.toHaveProperty("user");
    expect(callArg).not.toHaveProperty("session");
    expect(callArg).not.toHaveProperty("favoriteEventIds");
  });

  it("IA matérialisée hors callback unstable_cache (pas d’imbrication)", async () => {
    const { getCachedPublicHomeData } = await import(
      "@/infrastructure/next-public-home-cache"
    );

    const order: string[] = [];
    getPublicHomeSnapshot.mockImplementation(async () => {
      order.push("snapshot-inside-cache");
      return {
        pipeline: { events: [] },
        explorerPage: { events: [], totalCount: 0, nextCursor: null },
        exposeDebug: false,
      };
    });
    materializePublicHomeData.mockImplementation(async () => {
      order.push("materialize-outside-cache");
      return {
        highlights: [],
        planningEvents: [],
        explorer: { events: [], totalCount: 0, nextCursor: null },
      };
    });

    await getCachedPublicHomeData();

    const cacheCb = unstable_cache.mock.calls[0]![0] as () => Promise<unknown>;
    // Le callback Home ne doit appeler que le snapshot (pas materialize / pas IA).
    expect(getPublicHomeSnapshot).toHaveBeenCalled();
    expect(materializePublicHomeData).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      "snapshot-inside-cache",
      "materialize-outside-cache",
    ]);

    // materialize n’est pas invoqué depuis le callback lui-même :
    // on rejoue le callback isolément après reset des compteurs.
    getPublicHomeSnapshot.mockClear();
    materializePublicHomeData.mockClear();
    await cacheCb();
    expect(getPublicHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(materializePublicHomeData).not.toHaveBeenCalled();
  });
});
