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

const getPublicExplorerInitialPage = vi.fn();

vi.mock("@/application/explorer/get-public-explorer-initial-page", () => ({
  getPublicExplorerInitialPage: (...args: unknown[]) =>
    getPublicExplorerInitialPage(...args),
}));

describe("next-public-explorer-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicExplorerInitialPage.mockResolvedValue({
      events: [],
      totalCount: 0,
      nextCursor: null,
    });
  });

  it("tag scope territoire public-explorer:orleans", async () => {
    const {
      PUBLIC_EXPLORER_CACHE_TAG,
      invalidatePublicExplorerCache,
    } = await import("@/infrastructure/next-public-explorer-cache");

    expect(PUBLIC_EXPLORER_CACHE_TAG).toBe("public-explorer:orleans");

    invalidatePublicExplorerCache();
    expect(revalidateTag).toHaveBeenCalledWith("public-explorer:orleans", "max");
  });

  it("getCachedPublicExplorerInitialPage wrap unstable_cache + clé versionnée", async () => {
    const {
      getCachedPublicExplorerInitialPage,
      PUBLIC_EXPLORER_CACHE_TAG,
    } = await import("@/infrastructure/next-public-explorer-cache");

    expect(getCachedPublicExplorerInitialPage.length).toBe(0);

    await getCachedPublicExplorerInitialPage();

    expect(unstable_cache).toHaveBeenCalledTimes(1);
    const [, keyParts, options] = unstable_cache.mock.calls[0]!;
    expect(keyParts).toEqual([
      "detour-public-explorer",
      "orleans",
      "initial-weekend-12-v1",
    ]);
    expect(options).toMatchObject({
      tags: [PUBLIC_EXPLORER_CACHE_TAG],
    });
    expect(getPublicExplorerInitialPage).toHaveBeenCalledTimes(1);
  });

  it("callback cache n’appelle que getPublicExplorerInitialPage (pas Radar / IA)", async () => {
    const { getCachedPublicExplorerInitialPage } = await import(
      "@/infrastructure/next-public-explorer-cache"
    );

    await getCachedPublicExplorerInitialPage();

    const cacheCb = unstable_cache.mock.calls[0]![0] as () => Promise<unknown>;
    getPublicExplorerInitialPage.mockClear();
    await cacheCb();
    expect(getPublicExplorerInitialPage).toHaveBeenCalledTimes(1);
  });
});
