import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicEventSnapshotMock = vi.fn();
const applyPublicEventEndedStatusMock = vi.fn();
const unstableCacheMock = vi.fn();
const revalidateTagMock = vi.fn();

vi.mock("next/cache", () => ({
  unstable_cache: (...args: unknown[]) => unstableCacheMock(...args),
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

vi.mock("@/application/events/get-public-event-page", () => ({
  getPublicEventSnapshot: (...args: unknown[]) =>
    getPublicEventSnapshotMock(...args),
  applyPublicEventEndedStatus: (...args: unknown[]) =>
    applyPublicEventEndedStatusMock(...args),
}));

describe("getCachedPublicEventPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("calcule isEnded après le cache, sans re-fetch snapshot à chaque now", async () => {
    const snapshot = {
      status: "ok" as const,
      data: {
        eventId: "openagenda:1",
        item: { id: "openagenda:1", title: "X" },
        startAt: "2026-11-10T19:00:00.000Z",
        endAt: "2026-11-10T21:00:00.000Z",
      },
    };
    getPublicEventSnapshotMock.mockResolvedValue(snapshot);

    // Simule un Data Cache hit : factory exécutée une fois, puis réutilisée.
    let factory: (() => Promise<unknown>) | null = null;
    let cachedValue: unknown;
    unstableCacheMock.mockImplementation((fn: () => Promise<unknown>) => {
      factory = fn;
      return async () => {
        if (cachedValue === undefined) {
          cachedValue = await factory!();
        }
        return cachedValue;
      };
    });

    applyPublicEventEndedStatusMock.mockImplementation(
      (result: unknown, now: Date) => ({
        status: "ok",
        data: {
          ...(snapshot.data as object),
          isEnded: now.getTime() >= Date.parse("2026-11-10T21:00:00.000Z"),
          now: now.toISOString(),
        },
      }),
    );

    const { getCachedPublicEventPage } = await import(
      "@/infrastructure/next-public-event-cache"
    );

    const before = new Date("2026-11-10T20:00:00.000Z");
    const after = new Date("2026-11-10T22:00:00.000Z");

    const first = await getCachedPublicEventPage("openagenda:1", before);
    const second = await getCachedPublicEventPage("openagenda:1", after);

    expect(getPublicEventSnapshotMock).toHaveBeenCalledTimes(1);
    expect(applyPublicEventEndedStatusMock).toHaveBeenCalledTimes(2);
    expect(applyPublicEventEndedStatusMock).toHaveBeenNthCalledWith(
      1,
      snapshot,
      before,
    );
    expect(applyPublicEventEndedStatusMock).toHaveBeenNthCalledWith(
      2,
      snapshot,
      after,
    );
    expect(first).toMatchObject({ data: { isEnded: false } });
    expect(second).toMatchObject({ data: { isEnded: true } });
  });
});
