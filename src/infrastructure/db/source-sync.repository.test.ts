import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@/infrastructure/db/postgres", () => ({
  getPool: () => ({ query }),
}));

import {
  lockAndVerifyLease,
  markError,
  markSuccess,
  releaseLease,
  tryAcquireLease,
} from "@/infrastructure/db/source-sync.repository";
import type { PoolClient } from "pg";

describe("source-sync.repository lease primitives", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("tryAcquireLease true quand rowCount=1", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    const ok = await tryAcquireLease(
      "orleans",
      "token-a",
      new Date("2026-09-06T13:00:00.000Z"),
    );
    expect(ok).toBe(true);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("sync_lock_token = $2");
    expect(sql).toContain("sync_locked_until IS NULL");
    expect(sql).toContain("last_attempt_at = now()");
    expect(params[0]).toBe("orleans");
    expect(params[1]).toBe("token-a");
    expect(sql).not.toContain("token-a");
  });

  it("tryAcquireLease false quand rowCount=0 (busy)", async () => {
    query.mockResolvedValue({ rowCount: 0 });
    const ok = await tryAcquireLease(
      "orleans",
      "token-b",
      new Date("2026-09-06T13:00:00.000Z"),
    );
    expect(ok).toBe(false);
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain("last_attempt_at = now()");
  });

  it("releaseLease filtré par token", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    const ok = await releaseLease("orleans", "token-a");
    expect(ok).toBe(true);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("sync_lock_token = $2");
    expect(params).toEqual(["orleans", "token-a"]);
  });

  it("releaseLease false si token incorrect", async () => {
    query.mockResolvedValue({ rowCount: 0 });
    expect(await releaseLease("orleans", "other")).toBe(false);
  });

  it("lockAndVerifyLease refuse si aucune ligne (token / lease invalide)", async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const client = { query: clientQuery } as unknown as PoolClient;
    expect(await lockAndVerifyLease("orleans", "token-a", client)).toBe(false);
    const [sql, params] = clientQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("sync_lock_token = $2");
    expect(sql).toContain("sync_locked_until IS NOT NULL");
    expect(sql).toContain("sync_locked_until > now()");
    expect(sql).toContain("FOR UPDATE");
    expect(params).toEqual(["orleans", "token-a"]);
  });

  it("lockAndVerifyLease ok si une ligne obtenue", async () => {
    const clientQuery = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ adapter_id: "orleans" }],
    });
    const client = { query: clientQuery } as unknown as PoolClient;
    expect(await lockAndVerifyLease("orleans", "token-a", client)).toBe(true);
    expect(clientQuery.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(clientQuery.mock.calls[0]?.[0]).toContain(
      "sync_locked_until > now()",
    );
  });

  it("markSuccess / markError conditionnés au token ; last_attempt_at non réécrit", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    const client = { query } as unknown as PoolClient;
    const at = new Date("2026-09-06T12:00:00.000Z");

    expect(
      await markSuccess(
        { adapterId: "orleans", token: "token-a", fetchedCount: 10, at },
        client,
      ),
    ).toBe(true);
    const successSql = query.mock.calls[0]?.[0] as string;
    expect(successSql).toContain("last_success_at = $3");
    expect(successSql).not.toContain("last_attempt_at");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "orleans",
      "token-a",
      at.toISOString(),
      10,
    ]);

    query.mockClear();
    query.mockResolvedValue({ rowCount: 1 });
    expect(
      await markError({
        adapterId: "orleans",
        token: "token-a",
        errorCode: "empty_corpus",
        errorMessageSafe: "empty corpus rejected",
      }),
    ).toBe(true);
    const errSql = query.mock.calls[0]?.[0] as string;
    expect(errSql).not.toContain("last_attempt_at");
    const errParams = query.mock.calls[0]?.[1] as unknown[];
    expect(errParams[0]).toBe("orleans");
    expect(errParams[1]).toBe("token-a");
    expect(errParams[2]).toBe("empty_corpus");
  });
});
