import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { deleteVerificationTokensForUser } from "@/infrastructure/auth/delete-user-verification-cleanup";

describe("deleteVerificationTokensForUser", () => {
  it("supprime uniquement les verification dont value = userId", async () => {
    const calls: unknown[][] = [];
    const pool = {
      query: async (...args: unknown[]) => {
        calls.push(args);
        return { rowCount: 2 };
      },
    } as unknown as Pool;

    const deleted = await deleteVerificationTokensForUser(
      pool,
      "11111111-1111-1111-1111-111111111111",
    );

    expect(deleted).toBe(2);
    expect(calls).toHaveLength(1);
    const [sql, params] = calls[0] ?? [];
    expect(String(sql)).toMatch(/DELETE FROM "verification" WHERE value = \$1/);
    expect(String(sql)).not.toMatch(/LIKE/i);
    expect(params).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });
});
