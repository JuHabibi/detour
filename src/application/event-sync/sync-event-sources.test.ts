import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventSource } from "@/application/ports/event-source";
import type { SyncResult } from "@/application/event-sync/sync-types";

const syncEventSource = vi.fn();

vi.mock("@/application/event-sync/sync-event-source", () => ({
  syncEventSource: (...args: unknown[]) => syncEventSource(...args),
}));

import { syncEventSources } from "@/application/event-sync/sync-event-sources";

describe("syncEventSources", () => {
  const from = new Date("2026-09-06T12:00:00.000Z");
  const to = new Date("2026-10-01T12:00:00.000Z");
  const now = () => from;

  beforeEach(() => {
    syncEventSource.mockReset();
  });

  it("MULTI : Orléans error n’empêche pas Saran", async () => {
    const orleans: EventSource = {
      fetchUpcomingEvents: vi.fn(),
    };
    const saran: EventSource = {
      fetchUpcomingEvents: vi.fn(),
    };

    const orleansError: SyncResult = {
      adapterId: "orleans",
      status: "error",
      errorCode: "fetch_failed",
    };
    const saranOk: SyncResult = {
      adapterId: "saran",
      status: "success",
      fetchedCount: 4,
      deactivatedCount: 0,
    };

    syncEventSource
      .mockResolvedValueOnce(orleansError)
      .mockResolvedValueOnce(saranOk);

    const results = await syncEventSources({
      sources: [
        { adapterId: "orleans", adapter: orleans },
        { adapterId: "saran", adapter: saran },
      ],
      from,
      to,
      now,
    });

    expect(results).toEqual([orleansError, saranOk]);
    expect(syncEventSource).toHaveBeenCalledTimes(2);
    expect(syncEventSource.mock.calls[0]?.[0]).toMatchObject({
      adapterId: "orleans",
      adapter: orleans,
    });
    expect(syncEventSource.mock.calls[1]?.[0]).toMatchObject({
      adapterId: "saran",
      adapter: saran,
    });
  });

  it("séquence : sources dans l’ordre, même window", async () => {
    syncEventSource.mockResolvedValue({
      adapterId: "a",
      status: "skipped",
      reason: "busy",
    });

    await syncEventSources({
      sources: [
        { adapterId: "a", adapter: { fetchUpcomingEvents: vi.fn() } },
        { adapterId: "b", adapter: { fetchUpcomingEvents: vi.fn() } },
      ],
      from,
      to,
      now,
    });

    expect(syncEventSource.mock.calls[0]?.[0].from).toBe(from);
    expect(syncEventSource.mock.calls[0]?.[0].to).toBe(to);
    expect(syncEventSource.mock.calls[0]?.[0].now).toBe(now);
    expect(syncEventSource.mock.calls[1]?.[0].adapterId).toBe("b");
  });

  it("filet : throw inattendu → SyncResult error, suite exécutée", async () => {
    syncEventSource
      .mockRejectedValueOnce(new Error("unexpected"))
      .mockResolvedValueOnce({
        adapterId: "saran",
        status: "success",
        fetchedCount: 1,
        deactivatedCount: 0,
      });

    const results = await syncEventSources({
      sources: [
        { adapterId: "orleans", adapter: { fetchUpcomingEvents: vi.fn() } },
        { adapterId: "saran", adapter: { fetchUpcomingEvents: vi.fn() } },
      ],
      from,
      to,
      now,
    });

    expect(results[0]).toEqual({
      adapterId: "orleans",
      status: "error",
      errorCode: "database_failed",
    });
    expect(results[1]).toMatchObject({ adapterId: "saran", status: "success" });
  });
});
