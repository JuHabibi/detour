import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/db/postgres", () => ({
  getPool: vi.fn(),
}));

import {
  addEventToGroupForUser,
  createGroupForUser,
  deleteGroupForUser,
  getGroupWithEventsForUser,
  listGroupsForUser,
  normalizeGroupName,
  removeEventFromGroupForUser,
  renameGroupForUser,
} from "@/infrastructure/db/group.repository";
import { getPool } from "@/infrastructure/db/postgres";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("normalizeGroupName", () => {
  it("trim et refuse blanc", () => {
    expect(normalizeGroupName("  Week-end  ")).toBe("Week-end");
    expect(normalizeGroupName("   ")).toBeNull();
    expect(normalizeGroupName(null)).toBeNull();
  });
});

describe("group.repository — ownership / IDOR", () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    vi.mocked(getPool).mockReturnValue({ query } as never);
  });

  it("createGroupForUser insère scoppé user_id", async () => {
    const now = new Date("2026-09-16T10:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          id: GROUP_A,
          user_id: USER_A,
          name: "Week-end",
          created_at: now,
          updated_at: now,
        },
      ],
    });

    const group = await createGroupForUser(USER_A, "  Week-end  ");
    expect(group).toEqual({
      id: GROUP_A,
      userId: USER_A,
      name: "Week-end",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO groups (user_id, name)");
    expect(params).toEqual([USER_A, "Week-end"]);
  });

  it("createGroupForUser refuse nom vide", async () => {
    await expect(createGroupForUser(USER_A, "   ")).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("listGroupsForUser filtre uniquement user_id session", async () => {
    query.mockResolvedValue({ rows: [] });
    await listGroupsForUser(USER_A);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE user_id = $1");
    expect(params).toEqual([USER_A]);
    expect(sql).not.toContain("WHERE id =");
  });

  it("listGroupSummariesForUser JOINs counts scoppés user_id", async () => {
    const { listGroupSummariesForUser } = await import(
      "@/infrastructure/db/group.repository"
    );
    const now = new Date("2026-09-16T10:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          id: GROUP_A,
          user_id: USER_A,
          name: "Week-end",
          created_at: now,
          updated_at: now,
          event_count: 2,
          earliest_start_at: new Date("2026-10-01T18:00:00.000Z"),
          latest_start_at: new Date("2026-10-03T20:00:00.000Z"),
        },
      ],
    });

    const rows = await listGroupSummariesForUser(USER_A);
    expect(rows[0]).toMatchObject({
      eventCount: 2,
      earliestStartAt: "2026-10-01T18:00:00.000Z",
      latestStartAt: "2026-10-03T20:00:00.000Z",
    });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("COUNT(ge.event_id)");
    expect(sql).toContain("WHERE g.user_id = $1");
    expect(params).toEqual([USER_A]);
  });

  it("getGroupWithEventsForUser refuse implicitement user B (WHERE id + user_id)", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      getGroupWithEventsForUser(USER_B, GROUP_A),
    ).resolves.toBeNull();

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(
      /WHERE id = \$1[\s\S]*AND user_id = \$2/,
    );
    expect(params).toEqual([GROUP_A, USER_B]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("getGroupWithEventsForUser charge events si owned", async () => {
    const now = new Date("2026-09-16T10:00:00.000Z");
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: GROUP_A,
            user_id: USER_A,
            name: "Week-end",
            created_at: now,
            updated_at: now,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "openagenda:1",
            adapter_id: "orleans",
            title: "Concert",
            description: null,
            image_url: null,
            image_credit: null,
            image_license: null,
            image_source_url: null,
            start_at: new Date("2026-11-01T20:00:00.000Z"),
            end_at: null,
            all_day: false,
            venue: null,
            city: "Orléans",
            latitude: null,
            longitude: null,
            category: null,
            genre: null,
            conditions: null,
            source: null,
            source_url: null,
            registration_url: null,
            is_active: true,
            created_at: now,
            updated_at: now,
            last_seen_at: now,
          },
        ],
      });

    const group = await getGroupWithEventsForUser(USER_A, GROUP_A);
    expect(group?.name).toBe("Week-end");
    expect(group?.events).toHaveLength(1);
    expect(group?.events[0]?.id).toBe("openagenda:1");

    const [eventsSql] = query.mock.calls[1] as [string, unknown[]];
    expect(eventsSql).toContain("FROM group_events ge");
    expect(eventsSql).toContain("WHERE ge.group_id = $1");
  });

  it("renameGroupForUser UPDATE scoppé id + user_id", async () => {
    const now = new Date("2026-09-16T11:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          id: GROUP_A,
          user_id: USER_A,
          name: "Nouveau",
          created_at: now,
          updated_at: now,
        },
      ],
    });

    await expect(
      renameGroupForUser(USER_A, GROUP_A, "Nouveau"),
    ).resolves.toMatchObject({ name: "Nouveau" });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(
      /UPDATE groups[\s\S]*WHERE id = \$1[\s\S]*AND user_id = \$2/,
    );
    expect(params).toEqual([GROUP_A, USER_A, "Nouveau"]);
  });

  it("renameGroupForUser user B → null (0 row)", async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(
      renameGroupForUser(USER_B, GROUP_A, "Hack"),
    ).resolves.toBeNull();
  });

  it("deleteGroupForUser DELETE scoppé id + user_id (anti-IDOR)", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    await expect(deleteGroupForUser(USER_A, GROUP_A)).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(
      /DELETE FROM groups[\s\S]*WHERE id = \$1[\s\S]*AND user_id = \$2/,
    );
    expect(params).toEqual([GROUP_A, USER_A]);
  });

  it("deleteGroupForUser user B → false", async () => {
    query.mockResolvedValue({ rowCount: 0 });
    await expect(deleteGroupForUser(USER_B, GROUP_A)).resolves.toBe(false);
  });

  it("addEventToGroupForUser INSERT via owned CTE (pas de groupId seul)", async () => {
    query.mockResolvedValue({
      rows: [{ owned: true, inserted: true }],
    });

    await expect(
      addEventToGroupForUser(USER_A, GROUP_A, "openagenda:1"),
    ).resolves.toEqual({ status: "added" });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("FROM groups");
    expect(sql).toContain("user_id = $2");
    expect(sql).toContain("ON CONFLICT (group_id, event_id) DO NOTHING");
    expect(params).toEqual([GROUP_A, USER_A, "openagenda:1"]);
  });

  it("addEventToGroupForUser doublon → already_member", async () => {
    query.mockResolvedValue({
      rows: [{ owned: true, inserted: false }],
    });
    await expect(
      addEventToGroupForUser(USER_A, GROUP_A, "openagenda:1"),
    ).resolves.toEqual({ status: "already_member" });
  });

  it("addEventToGroupForUser user B → not_found", async () => {
    query.mockResolvedValue({
      rows: [{ owned: false, inserted: false }],
    });
    await expect(
      addEventToGroupForUser(USER_B, GROUP_A, "openagenda:1"),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("removeEventFromGroupForUser DELETE via JOIN groups.user_id", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    await expect(
      removeEventFromGroupForUser(USER_A, GROUP_A, "openagenda:1"),
    ).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("DELETE FROM group_events ge");
    expect(sql).toContain("USING groups g");
    expect(sql).toContain("g.user_id = $2");
    expect(params).toEqual([GROUP_A, USER_A, "openagenda:1"]);
  });

  it("removeEventFromGroupForUser user B → false", async () => {
    query.mockResolvedValue({ rowCount: 0 });
    await expect(
      removeEventFromGroupForUser(USER_B, GROUP_A, "openagenda:1"),
    ).resolves.toBe(false);
  });
});

describe("group.repository — contrat migration cascade", () => {
  it("migration : CASCADE group→group_events, pas de delete events", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(
        process.cwd(),
        "db/migrations/20260916120000_create_groups.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("REFERENCES groups (id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES events (id) ON DELETE CASCADE");
    expect(sql).toContain("PRIMARY KEY (group_id, event_id)");
    expect(sql).toContain("groups_user_id_created_at_idx");
    // Suppression groupe ≠ suppression events : pas de trigger delete events.
    expect(sql).not.toMatch(/DELETE\s+FROM\s+events/i);
  });
});
