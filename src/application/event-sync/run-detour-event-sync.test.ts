import { beforeEach, describe, expect, it, vi } from "vitest";

const syncEventSourcesMock = vi.fn();
const createDetourSyncSourcesMock = vi.fn();

vi.mock("@/application/event-sync/sync-event-sources", () => ({
  syncEventSources: (...args: unknown[]) => syncEventSourcesMock(...args),
}));

vi.mock("@/infrastructure/create-detour-sync-sources", () => ({
  createDetourSyncSources: (...args: unknown[]) =>
    createDetourSyncSourcesMock(...args),
}));

import { runDetourEventSync } from "@/application/event-sync/run-detour-event-sync";

describe("runDetourEventSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("construit window 180j et appelle syncEventSources avec sources Detour", async () => {
    const fixed = new Date("2026-09-06T12:00:00.000Z");
    const sources = [
      { adapterId: "orleans", adapter: { fetchUpcomingEvents: vi.fn() } },
      { adapterId: "saran", adapter: { fetchUpcomingEvents: vi.fn() } },
    ];
    createDetourSyncSourcesMock.mockReturnValue(sources);
    syncEventSourcesMock.mockResolvedValue([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 1,
        deactivatedCount: 0,
      },
    ]);

    const results = await runDetourEventSync({ now: () => fixed });

    expect(createDetourSyncSourcesMock).toHaveBeenCalledTimes(1);
    expect(syncEventSourcesMock).toHaveBeenCalledTimes(1);
    const call = syncEventSourcesMock.mock.calls[0]?.[0] as {
      sources: unknown;
      from: Date;
      to: Date;
    };
    expect(call.sources).toBe(sources);
    expect(call.from).toEqual(fixed);
    const expectedTo = new Date(fixed);
    expectedTo.setDate(expectedTo.getDate() + 180);
    expect(call.to).toEqual(expectedTo);
    expect(results).toHaveLength(1);
  });
});
