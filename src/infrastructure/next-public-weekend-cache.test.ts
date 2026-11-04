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

const getPublicWeekendPage = vi.fn();

vi.mock("@/application/weekend/get-public-weekend-page", async () => {
  const actual = await vi.importActual<
    typeof import("@/application/weekend/get-public-weekend-page")
  >("@/application/weekend/get-public-weekend-page");
  return {
    ...actual,
    getPublicWeekendPage: (...args: unknown[]) => getPublicWeekendPage(...args),
  };
});

describe("next-public-weekend-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T12:00:00+01:00"));
    getPublicWeekendPage.mockResolvedValue({
      saturdayKey: "2026-11-07",
      sundayKey: "2026-11-08",
      weekendLabel: "samedi 7 et dimanche 8 novembre 2026",
      weekendFromIso: "2026-11-06T23:00:00.000Z",
      weekendToIso: "2026-11-08T22:59:59.999Z",
      events: [],
      culturalActiveCount: 0,
      explorerHref: "/explorer",
    });
  });

  it("tag scope territoire public-weekend:orleans", async () => {
    const {
      PUBLIC_WEEKEND_CACHE_TAG,
      invalidatePublicWeekendCache,
    } = await import("@/infrastructure/next-public-weekend-cache");

    expect(PUBLIC_WEEKEND_CACHE_TAG).toBe("public-weekend:orleans");
    invalidatePublicWeekendCache();
    expect(revalidateTag).toHaveBeenCalledWith("public-weekend:orleans", "max");
  });

  it("clé cache versionnée par samedi Paris", async () => {
    const { getCachedPublicWeekendPage, PUBLIC_WEEKEND_CACHE_TAG } =
      await import("@/infrastructure/next-public-weekend-cache");

    await getCachedPublicWeekendPage();

    expect(unstable_cache).toHaveBeenCalledTimes(1);
    const [, keyParts, options] = unstable_cache.mock.calls[0]!;
    expect(keyParts).toEqual([
      "detour-public-weekend",
      "orleans",
      "2026-11-07",
      "select-v1",
    ]);
    expect(options).toMatchObject({
      tags: [PUBLIC_WEEKEND_CACHE_TAG],
    });
  });
});
