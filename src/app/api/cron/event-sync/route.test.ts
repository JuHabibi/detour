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
        previousActiveCount: 11,
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
    delete process.env.CRON_SECRET;
  });

  it("refuse si CRON_SECRET absent", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("refuse si Authorization absent", async () => {
    const res = await GET(requestWithAuth());
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("refuse si mauvais secret", async () => {
    const res = await GET(requestWithAuth("Bearer wrong-secret-value"));
    expect(res.status).toBe(401);
    expect(runDetourEventSyncMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("200 + sync ; busy seul n’est pas une panne ; fraîcheur exposée", async () => {
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      status: string;
      results: unknown[];
      freshness: unknown[];
      availabilityError: null;
    };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("ok");
    expect(body.results).toEqual([
      {
        adapterId: "orleans",
        status: "success",
        fetchedCount: 10,
        deactivatedCount: 1,
        previousActiveCount: 11,
      },
      {
        adapterId: "saran",
        status: "skipped",
        reason: "busy",
      },
    ]);
    expect(body.freshness).toEqual([
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
    expect(runDetourEventSyncMock).toHaveBeenCalledTimes(1);
    expect(runDetourAvailabilityEnrichmentMock).toHaveBeenCalledTimes(1);
    expect(body.availabilityError).toBeNull();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).toHaveBeenCalledTimes(3);
    expect(revalidateTagMock).toHaveBeenCalledWith("public-home:orleans", "max");
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "public-explorer:orleans",
      "max",
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("public-events", "max");
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("une source en erreur → 503 partial (détectable Cron)", async () => {
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

    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      ok: boolean;
      status: string;
      errorCount: number;
    };
    expect(body.ok).toBe(false);
    expect(body.status).toBe("partial");
    expect(body.errorCount).toBe(1);
    expect(revalidateTagMock).toHaveBeenCalled();
  });

  it("toutes les sources en erreur → 503 error", async () => {
    runDetourEventSyncMock.mockResolvedValue([
      { adapterId: "orleans", status: "error", errorCode: "fetch_failed" },
      { adapterId: "saran", status: "error", errorCode: "empty_corpus" },
    ]);

    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body.ok).toBe(false);
    expect(body.status).toBe("error");
  });

  it("sync OK même si enrichissement disponibilité échoue ; revalidate tag SWR quand même", async () => {
    runDetourAvailabilityEnrichmentMock.mockRejectedValue(
      new Error("mapado down"),
    );
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
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
    expect(revalidateTagMock).toHaveBeenCalledWith("public-events", "max");
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("500 générique si throw inattendu ; pas de revalidate", async () => {
    runDetourEventSyncMock.mockRejectedValue(
      new Error("boom with DATABASE_URL"),
    );
    const res = await GET(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
