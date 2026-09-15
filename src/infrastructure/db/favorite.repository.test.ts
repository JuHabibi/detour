import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/db/postgres", () => ({
  getPool: vi.fn(),
}));

import {
  addFavorite,
  listFavoriteEventIdsForUser,
  listFavoriteEventsForUser,
  removeFavorite,
} from "@/infrastructure/db/favorite.repository";
import { getPool } from "@/infrastructure/db/postgres";

describe("favorite.repository", () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    vi.mocked(getPool).mockReturnValue({ query } as never);
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

  it("removeFavorite DELETE scoppé user_id + event_id (anti-BOLA)", async () => {
    query.mockResolvedValue({ rowCount: 1 });

    await expect(
      removeFavorite(
        "11111111-1111-4111-8111-111111111111",
        "openagenda:1",
      ),
    ).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/DELETE FROM favorites[\s\S]*WHERE user_id = \$1[\s\S]*AND event_id = \$2/);
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "openagenda:1",
    ]);
    expect(sql).not.toMatch(/WHERE id = \$1\s*$/m);
  });

  it("removeFavorite retourne false si aucune ligne (autre user / inexistant)", async () => {
    query.mockResolvedValue({ rowCount: 0 });

    await expect(
      removeFavorite(
        "22222222-2222-4222-8222-222222222222",
        "openagenda:1",
      ),
    ).resolves.toBe(false);
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
