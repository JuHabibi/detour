import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/db/postgres", () => ({
  getPool: vi.fn(),
  withClient: vi.fn(),
}));

import {
  addFavorite,
  listFavoriteEventIdsForUser,
  listFavoriteEventsForUser,
  removeFavorite,
} from "@/infrastructure/db/favorite.repository";
import { getPool, withClient } from "@/infrastructure/db/postgres";

describe("favorite.repository", () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    vi.mocked(getPool).mockReturnValue({ query } as never);
    vi.mocked(withClient).mockImplementation(async (fn) =>
      fn({ query } as never),
    );
  });

  it("listFavoriteEventIdsForUser scope par user_id", async () => {
    query.mockResolvedValue({ rows: [{ event_id: "e1" }, { event_id: "e2" }] });

    await expect(
      listFavoriteEventIdsForUser("11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual(["e1", "e2"]);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE user_id = $1");
    expect(params).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });

  it("addFavorite est idempotent (ON CONFLICT DO NOTHING)", async () => {
    query.mockResolvedValue({ rowCount: 0 });

    await addFavorite(
      "11111111-1111-4111-8111-111111111111",
      "openagenda:1",
    );

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ON CONFLICT (user_id, event_id) DO NOTHING");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "openagenda:1",
    ]);
  });

  it("removeFavorite : transaction group_events puis favorites, scoppée user", async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ in_carnet: false }] }) // vérification
      .mockResolvedValueOnce({ rowCount: 0 }) // group_events
      .mockResolvedValueOnce({ rowCount: 1 }) // favorites
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await expect(
      removeFavorite(
        "11111111-1111-4111-8111-111111111111",
        "openagenda:1",
      ),
    ).resolves.toBe("removed");

    const sqls = query.mock.calls.map(([sql]) => String(sql));
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls[1]).toContain("SELECT EXISTS");
    expect(sqls[2]).toContain("DELETE FROM group_events ge");
    expect(sqls[2]).toContain("g.user_id = $1");
    expect(sqls[2]).toContain("ge.event_id = $2");
    expect(query.mock.calls[2]?.[1]).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "openagenda:1",
    ]);
    expect(sqls[3]).toMatch(
      /DELETE FROM favorites[\s\S]*WHERE user_id = \$1[\s\S]*AND event_id = \$2/,
    );
    expect(query.mock.calls[3]?.[1]).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "openagenda:1",
    ]);
    expect(sqls[4]).toBe("COMMIT");
  });

  it("demande une confirmation avant toute écriture si l'événement est dans un carnet", async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ in_carnet: true }] })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await expect(
      removeFavorite(
        "22222222-2222-4222-8222-222222222222",
        "openagenda:1",
      ),
    ).resolves.toBe("confirmation_required");
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual([
      "BEGIN",
      expect.stringContaining("SELECT EXISTS"),
      "COMMIT",
    ]);
  });

  it("retire les appartenances et le favori après confirmation", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      removeFavorite(
        "11111111-1111-4111-8111-111111111111",
        "openagenda:1",
        true,
      ),
    ).resolves.toBe("removed");
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual([
      "BEGIN",
      expect.stringContaining("DELETE FROM group_events ge"),
      expect.stringContaining("DELETE FROM favorites"),
      "COMMIT",
    ]);
  });

  it("removeFavorite ROLLBACK si le DELETE favorites échoue", async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // group_events OK
      .mockRejectedValueOnce(new Error("favorites write failed"))
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      removeFavorite(
        "11111111-1111-4111-8111-111111111111",
        "openagenda:1",
        true,
      ),
    ).rejects.toThrow("favorites write failed");

    const sqls = query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.at(-1)).toBe("ROLLBACK");
    expect(sqls).not.toContain("COMMIT");
  });

  it("listFavoriteEventsForUser JOIN events + filtre user_id", async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: "openagenda:1",
          adapter_id: "orleans",
          title: "Concert",
          description: null,
          image_url: null,
          start_at: new Date("2026-11-01T20:00:00.000Z"),
          end_at: null,
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
          created_at: new Date(),
          updated_at: new Date(),
          last_seen_at: new Date(),
        },
      ],
    });

    const events = await listFavoriteEventsForUser(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("openagenda:1");
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("FROM favorites f");
    expect(sql).toContain("INNER JOIN events e");
    expect(sql).toContain("WHERE f.user_id = $1");
    expect(params).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });
});
