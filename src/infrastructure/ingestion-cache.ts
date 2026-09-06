import {
  isPartialIngestion,
  type EventIngestionResult,
} from "@/application/ingestion/event-ingestion-result";
import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import {
  isIngestingEventSource,
  type IngestingEventSource,
} from "@/infrastructure/composite-event-source.adapter";

/** TTL ingestion : 1 h — bucket + revalidate Next alignés. */
export const INGESTION_CACHE_TTL_SECONDS = 60 * 60;
export const INGESTION_CACHE_TTL_MS = INGESTION_CACHE_TTL_SECONDS * 1000;

/** Forme JSON-safe pour Next Data Cache / mémoire. */
export type SerializableIngestionResult = {
  events: DetourEvent[];
  adapterByEventId: Array<[string, string]>;
  rawCountByAdapter: Array<[string, number]>;
  statusByAdapter: Array<[string, "ok" | "error"]>;
  sourceNameByAdapter: Array<[string, string]>;
  adapterOrder: string[];
};

/** Résultat du compute : le store décide selon `cacheable`. */
export type IngestionComputeResult = {
  payload: SerializableIngestionResult;
  cacheable: boolean;
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
  compute: () => Promise<IngestionComputeResult>,
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
 * - avec TTL 1 h : sur-fetch max ≈ +1 h en haut vs la fenêtre métier demandée
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
    cacheKey: `detour-ingestion:v2:${fromBucketMs}:${durationSec}`,
  };
}

export function serializeIngestionResult(
  result: EventIngestionResult,
): SerializableIngestionResult {
  return {
    events: result.events,
    adapterByEventId: [...result.adapterByEventId.entries()],
    rawCountByAdapter: [...result.rawCountByAdapter.entries()],
    statusByAdapter: [...result.statusByAdapter.entries()],
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
    statusByAdapter: new Map(payload.statusByAdapter),
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
  const store = new Map<
    string,
    { entry: SerializableIngestionResult; expiresAt: number }
  >();

  return async (cacheKey, compute) => {
    const record = store.get(cacheKey);
    if (record && record.expiresAt > now()) {
      if (stats) stats.hits += 1;
      return record.entry;
    }
    if (stats) stats.misses += 1;
    const { payload, cacheable } = await compute();
    if (cacheable) {
      store.set(cacheKey, { entry: payload, expiresAt: now() + ttlMs });
    }
    return payload;
  };
}

/**
 * Wrapper infrastructure : cache l’ingestion composite, pas le ranking.
 * EventService reste agnostique du mécanisme Next/mémoire.
 *
 * Singleflight in-process sur `cacheKey` : plusieurs cold misses concurrents
 * partagent une seule Promise (pas de cache supplémentaire ; multi-instance hors scope).
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
      statusByAdapter: new Map([["default", "ok"]]),
      sourceNameByAdapter: new Map([["default", "default"]]),
      adapterOrder: ["default"],
    };
  };

  const inflight = new Map<string, Promise<SerializableIngestionResult>>();

  const cached: EventSourceAdapter & IngestingEventSource = {
    async ingestUpcomingEvents(params) {
      const window = resolveIngestionCacheWindow(params.from, params.to);

      const existing = inflight.get(window.cacheKey);
      if (existing) {
        return deserializeIngestionResult(await existing);
      }

      const pending = readThrough(window.cacheKey, async () => {
        const result = await ingestInner({
          from: window.from,
          to: window.to,
        });
        return {
          payload: serializeIngestionResult(result),
          cacheable: !isPartialIngestion(result),
        };
      }).finally(() => {
        if (inflight.get(window.cacheKey) === pending) {
          inflight.delete(window.cacheKey);
        }
      });

      inflight.set(window.cacheKey, pending);
      return deserializeIngestionResult(await pending);
    },
    async fetchUpcomingEvents(params) {
      const ingestion = await cached.ingestUpcomingEvents(params);
      return ingestion.events;
    },
  };

  return cached;
}
