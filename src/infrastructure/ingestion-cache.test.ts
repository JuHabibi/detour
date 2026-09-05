import { describe, expect, it, vi } from "vitest";
import {
  createMemoryIngestionReadThrough,
  deserializeIngestionResult,
  INGESTION_CACHE_TTL_MS,
  resolveIngestionCacheWindow,
  serializeIngestionResult,
  wrapWithIngestionCache,
} from "@/infrastructure/ingestion-cache";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { DetourEvent } from "@/domain/event";

function stubEvent(id: string): DetourEvent {
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

describe("resolveIngestionCacheWindow", () => {
  it("deux instants dans le même bucket → même clé", () => {
    const a = resolveIngestionCacheWindow(
      new Date("2026-09-05T10:01:00.123Z"),
      new Date("2027-03-04T10:01:00.123Z"),
    );
    const b = resolveIngestionCacheWindow(
      new Date("2026-09-05T10:09:59.999Z"),
      new Date("2027-03-04T10:09:59.999Z"),
    );
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.from.getTime()).toBe(b.from.getTime());
    expect(a.to.getTime()).toBe(b.to.getTime());
  });

  it("pas de nouvelle clé à chaque milliseconde", () => {
    const keys = new Set<string>();
    const base = Date.parse("2026-09-05T10:03:00.000Z");
    for (let i = 0; i < 50; i += 1) {
      const from = new Date(base + i);
      const to = new Date(from.getTime() + 180 * 24 * 60 * 60 * 1000);
      keys.add(resolveIngestionCacheWindow(from, to).cacheKey);
    }
    expect(keys.size).toBe(1);
  });

  it("la borne to ne recule pas par rapport à la fenêtre demandée", () => {
    const from = new Date("2026-09-05T10:07:00.000Z");
    const to = new Date(from.getTime() + 180 * 24 * 60 * 60 * 1000);
    const window = resolveIngestionCacheWindow(from, to);

    expect(window.to.getTime()).toBeGreaterThanOrEqual(to.getTime());
    // Couvre aussi la requête la plus tardive du même bucket.
    const lateFrom = new Date("2026-09-05T10:09:59.000Z");
    const lateTo = new Date(lateFrom.getTime() + 180 * 24 * 60 * 60 * 1000);
    expect(window.to.getTime()).toBeGreaterThanOrEqual(lateTo.getTime());
    expect(window.cacheKey).toBe(
      resolveIngestionCacheWindow(lateFrom, lateTo).cacheKey,
    );
  });

  it("bucket suivant → autre clé", () => {
    const a = resolveIngestionCacheWindow(
      new Date("2026-09-05T10:00:00.000Z"),
      new Date("2027-03-04T10:00:00.000Z"),
    );
    const b = resolveIngestionCacheWindow(
      new Date("2026-09-05T10:10:00.000Z"),
      new Date("2027-03-04T10:10:00.000Z"),
    );
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });
});

describe("wrapWithIngestionCache", () => {
  it("deux requêtes dans le même bucket → une seule ingestion réelle", async () => {
    const stats = { hits: 0, misses: 0 };
    const fetchUpcomingEvents = vi.fn(async () => [stubEvent("a")]);
    const inner: EventSourceAdapter = { fetchUpcomingEvents };
    const cached = wrapWithIngestionCache(
      inner,
      createMemoryIngestionReadThrough({ stats }),
    );

    const from1 = new Date("2026-09-05T10:01:00.000Z");
    const to1 = new Date("2027-03-04T10:01:00.000Z");
    const from2 = new Date("2026-09-05T10:05:00.000Z");
    const to2 = new Date("2027-03-04T10:05:00.000Z");

    const first = await cached.fetchUpcomingEvents({ from: from1, to: to1 });
    const second = await cached.fetchUpcomingEvents({ from: from2, to: to2 });

    expect(fetchUpcomingEvents).toHaveBeenCalledTimes(1);
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
    expect(first).toEqual(second);
  });

  it("expiration → nouvel appel (revalidation mémoire)", async () => {
    let nowMs = Date.parse("2026-09-05T10:00:00.000Z");
    const fetchUpcomingEvents = vi.fn(async () => [stubEvent("a")]);
    const cached = wrapWithIngestionCache(
      { fetchUpcomingEvents },
      createMemoryIngestionReadThrough({
        now: () => nowMs,
        ttlMs: INGESTION_CACHE_TTL_MS,
      }),
    );

    const from = new Date(nowMs);
    const to = new Date(nowMs + 180 * 24 * 60 * 60 * 1000);

    await cached.fetchUpcomingEvents({ from, to });
    nowMs += INGESTION_CACHE_TTL_MS + 1;
    // Même bucket from → même clé, mais TTL mémoire expirée
    await cached.fetchUpcomingEvents({ from, to });

    expect(fetchUpcomingEvents).toHaveBeenCalledTimes(2);
  });

  it("serialize / deserialize conserve les Maps", () => {
    const result = {
      events: [stubEvent("x")],
      adapterByEventId: new Map([["x", "orleans"]]),
      rawCountByAdapter: new Map([["orleans", 1]]),
      sourceNameByAdapter: new Map([["orleans", "Orléans"]]),
      adapterOrder: ["orleans"],
    };
    const roundTrip = deserializeIngestionResult(serializeIngestionResult(result));
    expect(roundTrip.adapterByEventId.get("x")).toBe("orleans");
    expect(roundTrip.rawCountByAdapter.get("orleans")).toBe(1);
  });
});
