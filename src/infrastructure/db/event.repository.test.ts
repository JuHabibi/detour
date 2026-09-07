import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import type { DetourEvent } from "@/domain/events/event";
import {
  EVENT_UPSERT_CHUNK_SIZE,
  deactivateNotSeenSince,
  listUpcomingActive,
  listUpcomingActiveWithAdapter,
  upsertMany,
} from "@/infrastructure/db/event.repository";
import type { DbQueryable } from "@/infrastructure/db/postgres";

function event(id: string): DetourEvent {
  return {
    id,
    title: id,
    description: null,
    imageUrl: null,
    startAt: "2026-11-01T20:00:00.000Z",
    endAt: null,
    venue: null,
    city: null,
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
  };
}

describe("event.repository", () => {
  it("listUpcomingActiveWithAdapter : SQL overlap [from,to) + mapping", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "openagenda:1",
          adapter_id: "orleans",
          title: "A",
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
          created_at: new Date("2026-01-01T00:00:00.000Z"),
          updated_at: new Date("2026-01-01T00:00:00.000Z"),
          last_seen_at: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    const client = { query } as unknown as DbQueryable;

    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2027-03-01T00:00:00.000Z");
    const rows = await listUpcomingActiveWithAdapter({ from, to, client });

    expect(rows).toEqual([
      {
        adapterId: "orleans",
        event: expect.objectContaining({
          id: "openagenda:1",
          title: "A",
          city: "Orléans",
          startAt: "2026-11-01T20:00:00.000Z",
        }),
      },
    ]);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("e.is_active = true");
    expect(sql).toContain("e.start_at < $2");
    expect(sql).toContain("COALESCE(e.end_at, e.start_at) >= $1");
    expect(sql).toContain("LEFT JOIN event_availability");
    expect(sql).toContain("ORDER BY e.start_at ASC, e.id ASC");
    expect(params).toEqual([from.toISOString(), to.toISOString()]);
    expect(sql).not.toMatch(/Orléans|openagenda/);
  });

  it("listUpcomingActive est un wrapper sur WithAdapter", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as DbQueryable;
    const events = await listUpcomingActive({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2027-03-01T00:00:00.000Z"),
      client,
    });
    expect(events).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("upsertMany chunké sur le même client, valeurs en params", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const client = { query } as unknown as PoolClient;
    const marker = new Date("2026-09-06T12:00:00.000Z");
    const events = Array.from({ length: EVENT_UPSERT_CHUNK_SIZE + 3 }, (_, i) =>
      event(`openagenda:${i}`),
    );

    await upsertMany("orleans", events, marker, client);

    expect(query).toHaveBeenCalledTimes(2);
    const [sql1, values1] = query.mock.calls[0] as [string, unknown[]];
    const [sql2, values2] = query.mock.calls[1] as [string, unknown[]];
    expect(sql1).toContain("ON CONFLICT (id) DO UPDATE");
    expect(sql1).not.toMatch(/openagenda:0|orleans/);
    expect(values1[0]).toBe("openagenda:0");
    expect(values1[1]).toBe("orleans");
    expect(values2).toHaveLength(3 * 20);
  });

  it("deactivateNotSeenSince filtre adapter + marker en params", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 4 });
    const client = { query } as unknown as PoolClient;
    const marker = new Date("2026-09-06T12:00:00.000Z");

    const count = await deactivateNotSeenSince("orleans", marker, client);
    expect(count).toBe(4);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("is_active = false");
    expect(sql).toContain("last_seen_at < $2");
    expect(params).toEqual(["orleans", marker.toISOString()]);
  });
});
