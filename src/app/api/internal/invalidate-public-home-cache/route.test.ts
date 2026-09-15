import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTagMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

import { POST } from "@/app/api/internal/invalidate-public-home-cache/route";

const SECRET = "test-event-sync-secret";

function requestWithAuth(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request(
    "http://localhost/api/internal/invalidate-public-home-cache",
    {
      method: "POST",
      headers,
    },
  );
}

describe("POST /api/internal/invalidate-public-home-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVENT_SYNC_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.EVENT_SYNC_SECRET;
  });

  it("refuse si EVENT_SYNC_SECRET absent", async () => {
    delete process.env.EVENT_SYNC_SECRET;
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("refuse si Authorization absent", async () => {
    const res = await POST(requestWithAuth());
    expect(res.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("refuse si mauvais secret", async () => {
    const res = await POST(requestWithAuth("Bearer wrong-secret-value"));
    expect(res.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("200 + revalidateTag public-home uniquement", async () => {
    const res = await POST(requestWithAuth(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      invalidated: string;
      note: string;
    };
    expect(body).toEqual({
      ok: true,
      invalidated: "public-home-cache",
      note: "diagnostic_only_no_sync_no_ai_cache",
    });
    expect(revalidateTagMock).toHaveBeenCalledTimes(1);
    expect(revalidateTagMock).toHaveBeenCalledWith("public-home:orleans", {
      expire: 0,
    });
  });
});
