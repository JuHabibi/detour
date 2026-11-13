import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import type { DetourEvent, EventOccurrence } from "@/domain/events/event";
import { upsertMany } from "./event.repository";

const MIGRATION = "20261111120000_create_event_occurrences.sql";
function migration(name: string) {
  return readFileSync(new URL(`../../../db/migrations/${name}`, import.meta.url), "utf8");
}
const marker = new Date("2026-11-11T12:00:00Z");
const later = new Date("2026-11-12T12:00:00Z");
const session: EventOccurrence = {
  startAt: "2026-11-14T19:00:00.000Z",
  endAt: "2026-11-14T21:00:00.000Z",
  allDay: false,
};
const nextSession: EventOccurrence = {
  ...session,
  startAt: "2026-11-27T19:00:00.000Z",
  endAt: "2026-11-27T21:00:00.000Z",
};
function event(id: string, occurrences?: EventOccurrence[]): DetourEvent {
  return {
    id, title: "Concert", description: null, imageUrl: null,
    startAt: "2026-10-02T19:00:00.000Z", endAt: "2026-10-02T21:00:00.000Z",
    venue: null, city: null, latitude: null, longitude: null,
    category: "Musique", genre: null, conditions: null,
    source: null, sourceUrl: null, registrationUrl: null, occurrences,
  };
}

describe("event occurrences — vraie transaction PostgreSQL (PGlite)", () => {
  let db: PGlite;
  let client: PoolClient;

  beforeAll(async () => {
    db = new PGlite();
    // Les migrations réelles vérifient aussi la compatibilité de l’upsert existant.
    for (const name of [
      "20260906120000_create_events_and_source_syncs.sql",
      "20260907220000_add_event_normalized_explorer_fields.sql",
      "20260908120000_add_event_all_day.sql",
      "20260912150000_add_event_image_attribution.sql",
      "20261101150000_add_event_audience_jeune_public.sql",
      "20261101210000_add_cinema_product_category.sql",
      MIGRATION,
    ]) {
      await db.exec(migration(name).split("-- migrate:down")[0]);
    }
    client = { query: (sql: string, values?: unknown[]) => db.query(sql, values) } as unknown as PoolClient;
  });
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => { await db.exec("TRUNCATE events CASCADE"); });

  async function sync(events: DetourEvent[], at = marker) {
    await db.exec("BEGIN");
    try {
      await upsertMany("test", events, at, client);
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }
  async function sessions(id: string) {
    const result = await db.query<{ start_at: Date; end_at: Date; all_day: boolean }>(
      "SELECT start_at, end_at, all_day FROM event_occurrences WHERE event_id = $1 ORDER BY start_at, end_at", [id],
    );
    return result.rows.map((r) => ({ startAt: r.start_at.toISOString(), endAt: r.end_at.toISOString(), allDay: r.all_day }));
  }
  async function parent(id: string) {
    return (await db.query<{ title: string; occurrences_synced_at: Date | null; created_at: Date; start_at: Date }>(
      "SELECT title, occurrences_synced_at, created_at, start_at FROM events WHERE id = $1", [id],
    )).rows[0];
  }

  it("est idempotent, conserve l’identité/la période parent et remplace les séances retirées ou corrigées", async () => {
    await sync([event("a", [session, nextSession]), event("b", [session])]);
    const original = await parent("a");
    await sync([event("a", [session, nextSession])], later);
    expect(await sessions("a")).toEqual([session, nextSession]);
    const corrected = { ...nextSession, endAt: "2026-11-27T22:00:00.000Z" };
    await sync([event("a", [corrected])], later);
    expect(await sessions("a")).toEqual([corrected]);
    expect(await sessions("b")).toEqual([session]);
    expect(await parent("a")).toEqual({ ...original, occurrences_synced_at: later });
  });

  it("préserve le calendrier connu quand absent ; distingue vide explicite et inconnu", async () => {
    await sync([event("known", [session]), event("unknown")]);
    await sync([event("known"), event("unknown")], later);
    expect(await sessions("known")).toEqual([session]);
    expect((await parent("known")).occurrences_synced_at).toEqual(marker);
    expect((await parent("unknown")).occurrences_synced_at).toBeNull();
    await sync([event("known", [])], later);
    expect(await sessions("known")).toEqual([]);
    expect((await parent("known")).occurrences_synced_at).toEqual(later);
  });

  it("annule aussi l’upsert parent et le DELETE si une séance invalide fait échouer la transaction", async () => {
    await sync([event("a", [session])]);
    const original = await parent("a");
    await expect(sync([{ ...event("a", [{ ...session, endAt: "2026-11-01T00:00:00Z" }]), title: "Changed" }], later)).rejects.toThrow();
    expect(await parent("a")).toEqual(original);
    expect(await sessions("a")).toEqual([session]);
  });

  it("écrit plusieurs lots de séances pour un seul événement sans limite de paramètres ni perte", async () => {
    const many = Array.from({ length: 1005 }, (_, i) => ({
      startAt: new Date(marker.getTime() + i * 3600000).toISOString(),
      endAt: new Date(marker.getTime() + (i + 1) * 3600000).toISOString(),
      allDay: false,
    }));
    await sync([event("many", many)]);
    expect(await sessions("many")).toEqual(many);
  });

  it("persiste toutes les séances au-delà d’un lot d’upsert parent", async () => {
    const events = Array.from({ length: 153 }, (_, i) => event(`event-${i}`, [session]));
    await sync(events);
    const count = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM event_occurrences");
    expect(count.rows[0].n).toBe(153);
    expect(await sessions("event-152")).toEqual([session]);
  });

  it("préserve la borne exclusive all-day et supprime les séances avec le parent", async () => {
    const allDay = { startAt: "2026-11-14T00:00:00.000Z", endAt: "2026-11-15T00:00:00.000Z", allDay: true };
    await sync([event("a", [allDay])]);
    expect(await sessions("a")).toEqual([allDay]);
    await db.query("DELETE FROM events WHERE id = $1", ["a"]);
    expect(await sessions("a")).toEqual([]);
  });

  it("la migration est réversible sans supprimer les événements", async () => {
    await sync([event("a", [session])]);
    const sql = migration(MIGRATION).split("-- migrate:down");
    await db.exec(sql[1]);
    expect((await db.query("SELECT id FROM events")).rows).toEqual([{ id: "a" }]);
    await db.exec(sql[0]);
    expect((await parent("a")).occurrences_synced_at).toBeNull();
  });
});
