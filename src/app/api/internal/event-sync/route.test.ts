import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncEventSourcesMock = vi.fn();
const createDetourSyncSourcesMock = vi.fn();

vi.mock("@/application/event-sync/sync-event-sources", () => ({
  syncEventSources: (...args: unknown[]) => syncEventSourcesMock(...args),
}));

vi.mock("@/infrastructure/create-detour-sync-sources", () => ({
  createDetourSyncSources: (...args: unknown[]) =>
    createDetourSyncSourcesMock(...args),
}));

import { POST } from "@/app/api/internal/event-sync/route";

const SECRET = "test-event-sync-secret";

function requestWithAuth(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost/api/internal/event-sync", {
    method: "POST",
    headers,
  });
}

describe("POST /api/internal/event-sync", () => {
  const sources = [
    { adapterId: "orleans", adapter: { fetchUpcomingEvents: vi.fn() } },
    { adapterId: "saran", adapter: { fetchUpcomingEvents: vi.fn() } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVENT_SYNC_SECRET = SECRET;
    createDetourSyncSourcesMock.mockReturnValue(sources);
    syncEventSourcesMock.mockResolvedValue([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 2,
        deactivatedCount: 0,
      },
      {
        adapterId: "saran",
        status: "error",
        errorCode: "fetch_failed",
      },
    ]);
  });

  afterEach(() => {
    delete process.env.EVENT_SYNC_SECRET;
  });

  it("refuse si EVENT_SYNC_SECRET absent", async () => {
    delete process.env.EVENT_SYNC_SECRET;
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(401);
    expect(syncEventSourcesMock).not.toHaveBeenCalled();
  });

  it("refuse si Authorization absent", async () => {
    const res = await POST(requestWithAuth());
    expect(res.status).toBe(401);
    expect(syncEventSourcesMock).not.toHaveBeenCalled();
  });

  it("refuse si mauvais secret", async () => {
    const res = await POST(requestWithAuth("Bearer wrong-secret-value"));
    expect(res.status).toBe(401);
    expect(syncEventSourcesMock).not.toHaveBeenCalled();
  });

  it("refuse si format Authorization incorrect", async () => {
    const res = await POST(requestWithAuth(`Basic ${SECRET}`));
    expect(res.status).toBe(401);
    expect(syncEventSourcesMock).not.toHaveBeenCalled();
  });

  it("200 + sync appelée avec window 180j même si SyncResult error", async () => {
    const before = Date.now();
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(2);
    expect(body.results[1]).toMatchObject({
      adapterId: "saran",
      status: "error",
      errorCode: "fetch_failed",
    });

    expect(createDetourSyncSourcesMock).toHaveBeenCalledTimes(1);
    expect(syncEventSourcesMock).toHaveBeenCalledTimes(1);
    const call = syncEventSourcesMock.mock.calls[0]?.[0] as {
      sources: unknown;
      from: Date;
      to: Date;
    };
    expect(call.sources).toBe(sources);
    expect(call.from.getTime()).toBeGreaterThanOrEqual(before);
    expect(call.from.getTime()).toBeLessThanOrEqual(after);

    const expectedTo = new Date(call.from);
    expectedTo.setDate(expectedTo.getDate() + 180);
    expect(call.to.getTime()).toBe(expectedTo.getTime());
  });

  it("500 générique si throw inattendu", async () => {
    syncEventSourcesMock.mockRejectedValue(new Error("boom with DATABASE_URL"));
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(body)).not.toContain("boom");
  });
});
