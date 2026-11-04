import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runDetourEventSyncMock = vi.fn();
const runDetourAvailabilityEnrichmentMock = vi.fn();
const loadSyncFreshnessMock = vi.fn();
const revalidatePathMock = vi.fn();
const revalidateTagMock = vi.fn();
const updateTagMock = vi.fn();

vi.mock("@/application/event-sync/run-detour-event-sync", () => ({
  runDetourEventSync: (...args: unknown[]) => runDetourEventSyncMock(...args),
}));

vi.mock("@/application/availability/run-detour-availability-enrichment", () => ({
  runDetourAvailabilityEnrichment: (...args: unknown[]) =>
    runDetourAvailabilityEnrichmentMock(...args),
}));

vi.mock("@/application/event-sync/load-sync-freshness", () => ({
  loadSyncFreshness: (...args: unknown[]) => loadSyncFreshnessMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  updateTag: (...args: unknown[]) => updateTagMock(...args),
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
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVENT_SYNC_SECRET = SECRET;
    runDetourEventSyncMock.mockResolvedValue([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 2,
        deactivatedCount: 0,
        previousActiveCount: 2,
      },
      {
        adapterId: "saran",
        status: "error",
        errorCode: "fetch_failed",
      },
    ]);
    runDetourAvailabilityEnrichmentMock.mockResolvedValue({
      mapadoChecy: { matchCount: 0 },
    });
    loadSyncFreshnessMock.mockResolvedValue([
      {
        adapterId: "orleans",
        lastSuccessAt: "2026-11-01T05:00:00.000Z",
        freshness: "fresh",
      },
      {
        adapterId: "saran",
        lastSuccessAt: "2026-10-30T05:00:00.000Z",
        freshness: "stale",
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
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("refuse si Authorization absent", async () => {
    const res = await POST(requestWithAuth());
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("refuse si mauvais secret", async () => {
    const res = await POST(requestWithAuth("Bearer wrong-secret-value"));
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("refuse si format Authorization incorrect", async () => {
    const res = await POST(requestWithAuth(`Basic ${SECRET}`));
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("SyncResult error → 503 partial + freshness ; revalidateTag SWR max", async () => {
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      ok: boolean;
      status: string;
      results: unknown[];
      freshness: unknown[];
    };
    expect(body.ok).toBe(false);
    expect(body.status).toBe("partial");
    expect(body.results).toHaveLength(2);
    expect(body.freshness).toHaveLength(2);
    expect(runDetourEventSyncMock).toHaveBeenCalledTimes(1);
    expect(runDetourAvailabilityEnrichmentMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).toHaveBeenCalledTimes(4);
    expect(revalidateTagMock).toHaveBeenCalledWith("public-home:orleans", "max");
    expect(revalidateTagMock).toHaveBeenCalledWith("public-events", "max");
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "public-explorer:orleans",
      "max",
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "public-weekend:orleans",
      "max",
    );
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("toutes réussissent → 200 ok", async () => {
    runDetourEventSyncMock.mockResolvedValue([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 2,
        deactivatedCount: 0,
        previousActiveCount: 2,
      },
      {
        adapterId: "saran",
        status: "success",
        fetchedCount: 1,
        deactivatedCount: 0,
        previousActiveCount: 1,
      },
    ]);
    loadSyncFreshnessMock.mockResolvedValue([
      {
        adapterId: "orleans",
        lastSuccessAt: "2026-11-01T05:00:00.000Z",
        freshness: "fresh",
      },
      {
        adapterId: "saran",
        lastSuccessAt: "2026-11-01T05:00:00.000Z",
        freshness: "fresh",
      },
    ]);

    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("ok");
  });

  it("availability best-effort échoue → statut sync préservé + revalidate", async () => {
    runDetourEventSyncMock.mockResolvedValue([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 2,
        deactivatedCount: 0,
        previousActiveCount: 2,
      },
    ]);
    runDetourAvailabilityEnrichmentMock.mockRejectedValue(
      new Error("mapado down"),
    );
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      availabilityError: string | null;
      status: string;
    };
    expect(body.status).toBe("ok");
    expect(body.availabilityError).toBe("mapado down");
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).toHaveBeenCalledWith("public-home:orleans", "max");
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "public-explorer:orleans",
      "max",
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "public-weekend:orleans",
      "max",
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("public-events", "max");
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("500 générique si throw inattendu ; pas de revalidate", async () => {
    runDetourEventSyncMock.mockRejectedValue(
      new Error("boom with DATABASE_URL"),
    );
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(body)).not.toContain("boom");
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
