import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runDetourEventSyncMock = vi.fn();
const runDetourAvailabilityEnrichmentMock = vi.fn();
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

  it("200 + sync même si SyncResult error ; revalidatePath(/)", async () => {
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(2);
    expect(runDetourEventSyncMock).toHaveBeenCalledTimes(1);
    expect(runDetourAvailabilityEnrichmentMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("availability best-effort échoue → 200 + revalidatePath", async () => {
    runDetourAvailabilityEnrichmentMock.mockRejectedValue(
      new Error("mapado down"),
    );
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { availabilityError: string | null };
    expect(body.availabilityError).toBe("mapado down");
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("500 générique si throw inattendu ; pas de revalidatePath", async () => {
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
  });
});
