import type { EventIngestionResult } from "@/application/source-ingestion-stats";
import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import {
  isIngestingEventSource,
  type IngestingEventSource,
} from "@/infrastructure/composite-event-source.adapter";

/** TTL POC ingestion : 10 min (milieu de la fourchette 5–15). */
export const INGESTION_CACHE_TTL_SECONDS = 10 * 60;
export const INGESTION_CACHE_TTL_MS = INGESTION_CACHE_TTL_SECONDS * 1000;

/** Forme JSON-safe pour Next Data Cache / mémoire. */
export type SerializableIngestionResult = {
  events: DetourEvent[];
  adapterByEventId: Array<[string, string]>;
  rawCountByAdapter: Array<[string, number]>;
  sourceNameByAdapter: Array<[string, string]>;
  adapterOrder: string[];
};

export type IngestionCacheWindow = {
  /**
   * Fenêtre fetch stable pour tout le bucket :
   * from = début de bucket ; to = fin de bucket + durée demandée
   * (jamais plus courte que la borne haute métier demandée).
   */
  from: Date;
  to: Date;
  /** Clé stable — bucket from uniquement, pas de Date.now() à la ms. */
  cacheKey: string;
};

export type IngestionReadThrough = (
  cacheKey: string,
  compute: () => Promise<SerializableIngestionResult>,
) => Promise<SerializableIngestionResult>;

export type IngestionCacheStats = {
  hits: number;
  misses: number;
};

/**
 * Une seule politique de fraîcheur côté clé/fenêtre d’ingestion.
 *
 * - `cacheKey` : bucket sur `from` + durée (secondes) → partage entre requêtes proches
 * - fetch `from` : début du bucket (légèrement plus large en bas)
 * - fetch `to` : début du bucket + durée du bucket + durée demandée
 *   → la borne haute ne recule jamais vs la fenêtre demandée dans le bucket
 */
export function resolveIngestionCacheWindow(
  from: Date,
  to: Date,
  options?: { bucketMs?: number },
): IngestionCacheWindow {
  const bucketMs = options?.bucketMs ?? INGESTION_CACHE_TTL_MS;
  const fromBucketMs = Math.floor(from.getTime() / bucketMs) * bucketMs;
  const durationSec = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / 1000),
  );
  // Couvre la requête la plus tardive du bucket : from≈bucketEnd, to≈bucketEnd+duration.
  const fetchToMs = fromBucketMs + bucketMs + durationSec * 1000;

  return {
    from: new Date(fromBucketMs),
    to: new Date(fetchToMs),
    cacheKey: `detour-ingestion:v1:${fromBucketMs}:${durationSec}`,
  };
}

export function serializeIngestionResult(
  result: EventIngestionResult,
): SerializableIngestionResult {
  return {
    events: result.events,
    adapterByEventId: [...result.adapterByEventId.entries()],
    rawCountByAdapter: [...result.rawCountByAdapter.entries()],
    sourceNameByAdapter: [...result.sourceNameByAdapter.entries()],
    adapterOrder: [...result.adapterOrder],
  };
}

export function deserializeIngestionResult(
  payload: SerializableIngestionResult,
): EventIngestionResult {
  return {
    events: payload.events,
    adapterByEventId: new Map(payload.adapterByEventId),
    rawCountByAdapter: new Map(payload.rawCountByAdapter),
    sourceNameByAdapter: new Map(payload.sourceNameByAdapter),
    adapterOrder: payload.adapterOrder,
  };
}

/** Read-through mémoire — tests / scripts hors Next. */
export function createMemoryIngestionReadThrough(options?: {
  now?: () => number;
  ttlMs?: number;
  stats?: IngestionCacheStats;
}): IngestionReadThrough {
  const now = options?.now ?? Date.now;
  const ttlMs = options?.ttlMs ?? INGESTION_CACHE_TTL_MS;
  const stats = options?.stats;
  const store = new Map<string, { entry: SerializableIngestionResult; expiresAt: number }>();

  return async (cacheKey, compute) => {
    const record = store.get(cacheKey);
    if (record && record.expiresAt > now()) {
      if (stats) stats.hits += 1;
      return record.entry;
    }
    if (stats) stats.misses += 1;
    const entry = await compute();
    store.set(cacheKey, { entry, expiresAt: now() + ttlMs });
    return entry;
  };
}

/**
 * Wrapper infrastructure : cache l’ingestion composite, pas le ranking.
 * EventService reste agnostique du mécanisme Next/mémoire.
 */
export function wrapWithIngestionCache(
  inner: EventSourceAdapter,
  readThrough: IngestionReadThrough,
): EventSourceAdapter & IngestingEventSource {
  const ingestInner = async (params: {
    from: Date;
    to: Date;
  }): Promise<EventIngestionResult> => {
    if (isIngestingEventSource(inner)) {
      return inner.ingestUpcomingEvents(params);
    }
    const events = await inner.fetchUpcomingEvents(params);
    return {
      events,
      adapterByEventId: new Map(events.map((event) => [event.id, "default"])),
      rawCountByAdapter: new Map([["default", events.length]]),
      sourceNameByAdapter: new Map([["default", "default"]]),
      adapterOrder: ["default"],
    };
  };

  const cached: EventSourceAdapter & IngestingEventSource = {
    async ingestUpcomingEvents(params) {
      const window = resolveIngestionCacheWindow(params.from, params.to);
      const payload = await readThrough(window.cacheKey, async () => {
        const result = await ingestInner({
          from: window.from,
          to: window.to,
        });
        return serializeIngestionResult(result);
      });
      return deserializeIngestionResult(payload);
    },
    async fetchUpcomingEvents(params) {
      const ingestion = await cached.ingestUpcomingEvents(params);
      return ingestion.events;
    },
  };

  return cached;
}
