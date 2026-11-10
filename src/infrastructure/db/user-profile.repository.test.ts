import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import {
  getUserProfile,
  upsertUserProfile,
} from "@/infrastructure/db/user-profile.repository";
import type { DbQueryable } from "@/infrastructure/db/postgres";

function queryResult<T extends QueryResultRow>(
  rows: T[],
): QueryResult<T> {
  return {
    rows,
    rowCount: rows.length,
    command: "SELECT",
    oid: 0,
    fields: [],
  };
}

describe("user-profile.repository", () => {
  const queryMock = vi.fn<
    (text: string, values?: unknown[]) => Promise<QueryResult<QueryResultRow>>
  >();

  let client: DbQueryable;

  beforeEach(() => {
    queryMock.mockReset();
    client = {
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ): Promise<QueryResult<T>> {
        const result = await queryMock(text, values);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? result.rows.length,
          command: result.command,
          oid: result.oid,
          fields: result.fields,
        };
      },
    };
  });

  it("getUserProfile scope par user_id et renvoie null si absent", async () => {
    queryMock.mockResolvedValue(queryResult([]));

    await expect(
      getUserProfile("11111111-1111-4111-8111-111111111111", client),
    ).resolves.toBeNull();

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0]!;
    expect(sql).toContain("FROM user_profiles");
    expect(sql).toContain("WHERE user_id = $1");
    expect(params).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });

  it("upsertUserProfile mappe la ligne RETURNING", async () => {
    const createdAt = new Date("2026-11-10T10:00:00.000Z");
    const updatedAt = new Date("2026-11-10T11:00:00.000Z");
    queryMock.mockResolvedValue(
      queryResult([
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          interests: ["Cinéma"],
          availabilities: ["weekend-day"],
          budget: "free_preferred",
          onboarding_status: "completed",
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ]),
    );

    const profile = await upsertUserProfile(
      "11111111-1111-4111-8111-111111111111",
      {
        interests: ["Cinéma"],
        availabilities: ["weekend-day"],
        budget: "free_preferred",
        onboardingStatus: "completed",
      },
      client,
    );

    expect(profile).toEqual({
      userId: "11111111-1111-4111-8111-111111111111",
      interests: ["Cinéma"],
      availabilities: ["weekend-day"],
      budget: "free_preferred",
      onboardingStatus: "completed",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

    const [sql, params] = queryMock.mock.calls[0]!;
    expect(sql).toContain("ON CONFLICT (user_id) DO UPDATE");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      ["Cinéma"],
      ["weekend-day"],
      "free_preferred",
      "completed",
    ]);
  });
});
