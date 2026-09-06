import { describe, expect, it, vi } from "vitest";
import {
  createMemoryIngestionReadThrough,
  deserializeIngestionResult,
  INGESTION_CACHE_TTL_MS,
  INGESTION_CACHE_TTL_SECONDS,
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

describe("ingestion TTL", () => {
  it("TTL = 1 h", () => {
    expect(INGESTION_CACHE_TTL_SECONDS).toBe(60 * 60);
    expect(INGESTION_CACHE_TTL_MS).toBe(60 * 60 * 1000);
  });
});

describe("resolveIngestionCacheWindow", () => {
  it("deux instants dans le même bucket 1 h → même clé", () => {
    const a = resolveIngestionCacheWindow(
      new Date("2026-09-05T10:01:00.123Z"),
      new Date("2027-03-04T10:01:00.123Z"),
    );
    const b = resolveIngestionCacheWindow(
      new Date("2026-09-05T10:59:59.999Z"),
      new Date("2027-03-04T10:59:59.999Z"),
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
    // Couvre aussi la requête la plus tardive du même bucket (fin d’heure).
    const lateFrom = new Date("2026-09-05T10:59:59.000Z");
    const lateTo = new Date(lateFrom.getTime() + 180 * 24 * 60 * 60 * 1000);
    expect(window.to.getTime()).toBeGreaterThanOrEqual(lateTo.getTime());
    expect(window.cacheKey).toBe(
      resolveIngestionCacheWindow(lateFrom, lateTo).cacheKey,
    );
  });

  it("bucket suivant (1 h) → autre clé", () => {
    const a = resolveIngestionCacheWindow(
      new Date("2026-09-05T10:00:00.000Z"),
      new Date("2027-03-04T10:00:00.000Z"),
    );
    const b = resolveIngestionCacheWindow(
      new Date("2026-09-05T11:00:00.000Z"),
      new Date("2027-03-04T11:00:00.000Z"),
    );
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });
});

describe("wrapWithIngestionCache", () => {
  it("warm hit ne compute pas", async () => {
    const stats = { hits: 0, misses: 0 };
    const fetchUpcomingEvents = vi.fn(async () => [stubEvent("a")]);
    const inner: EventSourceAdapter = { fetchUpcomingEvents };
    const cached = wrapWithIngestionCache(
      inner,
      createMemoryIngestionReadThrough({ stats }),
    );

    const from1 = new Date("2026-09-05T10:01:00.000Z");
    const to1 = new Date("2027-03-04T10:01:00.000Z");
    const from2 = new Date("2026-09-05T10:30:00.000Z");
    const to2 = new Date("2027-03-04T10:30:00.000Z");

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
    await cached.fetchUpcomingEvents({ from, to });

    expect(fetchUpcomingEvents).toHaveBeenCalledTimes(2);
  });

  it("2 appels concurrents même cacheKey => compute 1 seule fois", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchUpcomingEvents = vi.fn(async () => {
      await gate;
      return [stubEvent("a")];
    });

    const cached = wrapWithIngestionCache(
      { fetchUpcomingEvents },
      createMemoryIngestionReadThrough(),
    );

    const from = new Date("2026-09-05T10:01:00.000Z");
    const to = new Date("2027-03-04T10:01:00.000Z");

    const p1 = cached.fetchUpcomingEvents({ from, to });
    const p2 = cached.fetchUpcomingEvents({ from, to });
    release();
    const [a, b] = await Promise.all([p1, p2]);

    expect(fetchUpcomingEvents).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("deux cacheKeys différentes => deux computes", async () => {
    const fetchUpcomingEvents = vi.fn(async () => [stubEvent("a")]);
    const cached = wrapWithIngestionCache(
      { fetchUpcomingEvents },
      createMemoryIngestionReadThrough(),
    );

    await cached.fetchUpcomingEvents({
      from: new Date("2026-09-05T10:01:00.000Z"),
      to: new Date("2027-03-04T10:01:00.000Z"),
    });
    await cached.fetchUpcomingEvents({
      from: new Date("2026-09-05T11:01:00.000Z"),
      to: new Date("2027-03-04T11:01:00.000Z"),
    });

    expect(fetchUpcomingEvents).toHaveBeenCalledTimes(2);
  });

  it("compute throw => singleflight nettoyé, prochain appel peut retenter", async () => {
    const fetchUpcomingEvents = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([stubEvent("a")]);

    const cached = wrapWithIngestionCache(
      { fetchUpcomingEvents },
      createMemoryIngestionReadThrough(),
    );

    const from = new Date("2026-09-05T10:01:00.000Z");
    const to = new Date("2027-03-04T10:01:00.000Z");

    await expect(cached.fetchUpcomingEvents({ from, to })).rejects.toThrow(
      "boom",
    );
    const recovered = await cached.fetchUpcomingEvents({ from, to });
    expect(recovered.map((e) => e.id)).toEqual(["a"]);
    expect(fetchUpcomingEvents).toHaveBeenCalledTimes(2);
  });

  it("serialize / deserialize conserve les Maps", () => {
    const result = {
      events: [stubEvent("x")],
      adapterByEventId: new Map([["x", "orleans"]]),
      rawCountByAdapter: new Map([["orleans", 1]]),
      statusByAdapter: new Map([["orleans", "ok" as const]]),
      sourceNameByAdapter: new Map([["orleans", "Orléans"]]),
      adapterOrder: ["orleans"],
    };
    const roundTrip = deserializeIngestionResult(serializeIngestionResult(result));
    expect(roundTrip.adapterByEventId.get("x")).toBe("orleans");
    expect(roundTrip.rawCountByAdapter.get("orleans")).toBe(1);
    expect(roundTrip.statusByAdapter.get("orleans")).toBe("ok");
  });

  it("ingestion partielle (source error) → non persistée ; concurrent = 1 compute", async () => {
    const { CompositeEventSourceAdapter } = await import(
      "@/infrastructure/composite-event-source.adapter"
    );
    const { isPartialIngestion } = await import(
      "@/application/ingestion/event-ingestion-result"
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const orleansCalls = vi.fn(async () => {
      await gate;
      throw new Error("rate limit");
    });
    const saranCalls = vi.fn(async () => {
      await gate;
      return [stubEvent("saran:1")];
    });

    const composite = new CompositeEventSourceAdapter([
      {
        name: "orleans",
        label: "Orléans / OpenAgenda",
        adapter: { fetchUpcomingEvents: orleansCalls },
      },
      {
        name: "saran",
        label: "Ville de Saran",
        adapter: { fetchUpcomingEvents: saranCalls },
      },
    ]);

    const stats = { hits: 0, misses: 0 };
    const cached = wrapWithIngestionCache(
      composite,
      createMemoryIngestionReadThrough({ stats }),
    );

    const from = new Date("2026-09-05T10:01:00.000Z");
    const to = new Date("2027-03-04T10:01:00.000Z");

    const p1 = cached.ingestUpcomingEvents({ from, to });
    const p2 = cached.ingestUpcomingEvents({ from, to });
    release();
    const [first, concurrent] = await Promise.all([p1, p2]);

    expect(isPartialIngestion(first)).toBe(true);
    expect(concurrent.events.map((e) => e.id)).toEqual(["saran:1"]);
    expect(orleansCalls).toHaveBeenCalledTimes(1);
    expect(saranCalls).toHaveBeenCalledTimes(1);
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);

    const second = await cached.ingestUpcomingEvents({ from, to });
    expect(second.events.map((e) => e.id)).toEqual(["saran:1"]);
    expect(stats.misses).toBe(2);
    expect(stats.hits).toBe(0);
    expect(orleansCalls).toHaveBeenCalledTimes(2);
    expect(saranCalls).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
  });

  it("toutes sources ok → cacheable (hit sur 2e requête)", async () => {
    const { CompositeEventSourceAdapter } = await import(
      "@/infrastructure/composite-event-source.adapter"
    );

    const fetchOrleans = vi.fn(async () => [stubEvent("oa-1")]);
    const fetchSaran = vi.fn(async () => [stubEvent("saran:1")]);
    const composite = new CompositeEventSourceAdapter([
      {
        name: "orleans",
        label: "Orléans / OpenAgenda",
        adapter: { fetchUpcomingEvents: fetchOrleans },
      },
      {
        name: "saran",
        label: "Ville de Saran",
        adapter: { fetchUpcomingEvents: fetchSaran },
      },
    ]);

    const stats = { hits: 0, misses: 0 };
    const cached = wrapWithIngestionCache(
      composite,
      createMemoryIngestionReadThrough({ stats }),
    );

    const from = new Date("2026-09-05T10:01:00.000Z");
    const to = new Date("2027-03-04T10:01:00.000Z");

    const first = await cached.ingestUpcomingEvents({ from, to });
    expect(first.statusByAdapter.get("orleans")).toBe("ok");
    expect(first.statusByAdapter.get("saran")).toBe("ok");

    const second = await cached.ingestUpcomingEvents({ from, to });
    expect(second.events).toHaveLength(2);
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
    expect(fetchOrleans).toHaveBeenCalledTimes(1);
    expect(fetchSaran).toHaveBeenCalledTimes(1);
  });
});
