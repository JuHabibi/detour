import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runDetourEventSyncMock = vi.fn();
const runDetourAvailabilityEnrichmentMock = vi.fn();

vi.mock("@/application/event-sync/run-detour-event-sync", () => ({
  runDetourEventSync: (...args: unknown[]) => runDetourEventSyncMock(...args),
}));

vi.mock("@/application/availability/run-detour-availability-enrichment", () => ({
  runDetourAvailabilityEnrichment: (...args: unknown[]) =>
    runDetourAvailabilityEnrichmentMock(...args),
}));

import { GET } from "@/app/api/cron/event-sync/route";

const SECRET = "test-cron-secret";

function requestWithAuth(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost/api/cron/event-sync", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/event-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    runDetourEventSyncMock.mockResolvedValue([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 10,
        deactivatedCount: 1,
      },
      {
        adapterId: "saran",
        status: "skipped",
        reason: "busy",
      },
    ]);
    runDetourAvailabilityEnrichmentMock.mockResolvedValue({
      mapadoChecy: { matchCount: 0 },
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("refuse si CRON_SECRET absent", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
  });

  it("refuse si Authorization absent", async () => {
    const res = await GET(requestWithAuth());
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
  });

  it("refuse si mauvais secret", async () => {
    const res = await GET(requestWithAuth("Bearer wrong-secret-value"));
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
  });

  it("200 + sync appelée ; SyncResult skipped OK", async () => {
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: unknown[];
      availabilityError: null;
    };
    expect(body.results).toEqual([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 10,
        deactivatedCount: 1,
      },
      {
        adapterId: "saran",
        status: "skipped",
        reason: "busy",
      },
    ]);
    expect(runDetourEventSyncMock).toHaveBeenCalledTimes(1);
    expect(runDetourAvailabilityEnrichmentMock).toHaveBeenCalledTimes(1);
    expect(body.availabilityError).toBeNull();
  });

  it("sync OK même si enrichissement disponibilité échoue", async () => {
    runDetourAvailabilityEnrichmentMock.mockRejectedValue(
      new Error("mapado down"),
    );
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { availabilityError: string | null };
    expect(body.availabilityError).toBe("mapado down");
  });

  it("500 générique si throw inattendu", async () => {
    runDetourEventSyncMock.mockRejectedValue(
      new Error("boom with DATABASE_URL"),
    );
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });
});
