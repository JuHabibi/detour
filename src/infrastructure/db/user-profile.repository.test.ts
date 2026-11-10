import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/db/postgres", () => ({
  getPool: vi.fn(),
}));

import {
  getUserProfile,
  upsertUserProfile,
} from "@/infrastructure/db/user-profile.repository";
import { getPool } from "@/infrastructure/db/postgres";

describe("user-profile.repository", () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    vi.mocked(getPool).mockReturnValue({ query } as never);
  });

  it("getUserProfile scope par user_id et renvoie null si absent", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(
      getUserProfile("11111111-1111-4111-8111-111111111111"),
    ).resolves.toBeNull();

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("FROM user_profiles");
    expect(sql).toContain("WHERE user_id = $1");
    expect(params).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });

  it("upsertUserProfile mappe la ligne RETURNING", async () => {
    const createdAt = new Date("2026-11-10T10:00:00.000Z");
    const updatedAt = new Date("2026-11-10T11:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          interests: ["Cinéma"],
          availabilities: ["weekend-day"],
          budget: "free_preferred",
          onboarding_status: "completed",
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ],
    });

    const profile = await upsertUserProfile(
      "11111111-1111-4111-8111-111111111111",
      {
        interests: ["Cinéma"],
        availabilities: ["weekend-day"],
        budget: "free_preferred",
        onboardingStatus: "completed",
      },
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

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
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
