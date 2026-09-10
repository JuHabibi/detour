import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";
import {
  buildAiAssessmentEventCacheKey,
  type AiAssessmentCacheContext,
} from "@/application/ai/ai-assessment-cache-key";

export type { AiAssessmentCacheContext };

/** TTL : 6 heures. */
export const AI_ASSESSMENT_CACHE_TTL_SECONDS = 6 * 60 * 60;
export const AI_ASSESSMENT_CACHE_TTL_MS = AI_ASSESSMENT_CACHE_TTL_SECONDS * 1000;

/** Une entrée = un assessment pour une clé event. */
export type AiAssessmentCacheEntry = {
  assessment: AiHighlightAssessment;
  assessedAt: string;
};

export type AiAssessmentCacheSource =
  | "fresh"
  | "cache"
  | "partial"
  | "fallback";

export type AssessHighlightsCachedResult = {
  assessments: AiHighlightAssessment[];
  source: AiAssessmentCacheSource;
  cacheHits: number;
  cacheMisses: number;
  /** @deprecated Clé shortlist globale — toujours null en per-event. */
  cacheKey: string | null;
  assessedAt: string | null;
};

export type AiAssessmentCacheStore = {
  get(key: string): AiAssessmentCacheEntry | null;
  set(key: string, entry: AiAssessmentCacheEntry, ttlMs: number): void;
  delete(key: string): void;
};

type MemoryRecord = {
  entry: AiAssessmentCacheEntry;
  expiresAt: number;
};

/** Cache mémoire process-local — best effort (perdus au cold start / multi-instances). */
export function createMemoryAiAssessmentCacheStore(
  now: () => number = Date.now,
): AiAssessmentCacheStore {
  const store = new Map<string, MemoryRecord>();

  return {
    get(key) {
      const record = store.get(key);
      if (!record) return null;
      if (record.expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return record.entry;
    },
    set(key, entry, ttlMs) {
      store.set(key, { entry, expiresAt: now() + ttlMs });
    },
    delete(key) {
      store.delete(key);
    },
  };
}

const defaultMemoryStore = createMemoryAiAssessmentCacheStore();

function eventCacheKey(
  event: DetourEvent,
  context: AiAssessmentCacheContext,
): string {
  return buildAiAssessmentEventCacheKey({
    event,
    model: context.model,
    promptVersion: context.promptVersion,
    generation: context.generation,
  });
}

function resolveSource(params: {
  cacheHits: number;
  assessmentCount: number;
  shortlistSize: number;
  providerCalled: boolean;
  providerFailed: boolean;
}): AiAssessmentCacheSource {
  const {
    cacheHits,
    assessmentCount,
    shortlistSize,
    providerCalled,
    providerFailed,
  } = params;

  if (assessmentCount === 0) return "fallback";
  if (providerFailed) return "partial";
  if (!providerCalled) return "cache";
  if (cacheHits === 0 && assessmentCount === shortlistSize) return "fresh";
  return "partial";
}

class AssessmentOmittedError extends Error {
  constructor(eventId: string) {
    super(`AI assessment omitted for ${eventId}`);
    this.name = "AssessmentOmittedError";
  }
}

type BatchWaiter = {
  event: DetourEvent;
  resolve: (entry: AiAssessmentCacheEntry) => void;
  reject: (reason: unknown) => void;
};

/**
 * Batcher request-scoped : seuls les `compute()` réellement exécutés
 * (vrais misses Next) s’enregistrent ; un seul `assess` pour la vague.
 */
function createRequestScopedAssessmentBatcher(params: {
  assess: (events: DetourEvent[]) => Promise<AiHighlightAssessment[]>;
  assessedAt: string;
  totalLookups: number;
  onProviderCalled: () => void;
  onProviderFailed: () => void;
  onNextHit: () => void;
  onNextMiss: () => void;
}) {
  const {
    assess,
    assessedAt,
    totalLookups,
    onProviderCalled,
    onProviderFailed,
    onNextHit,
    onNextMiss,
  } = params;

  let declared = 0;
  const waiters: BatchWaiter[] = [];
  let batchPromise: Promise<void> | null = null;

  const startBatchIfReady = () => {
    if (declared < totalLookups || batchPromise) return;
    if (waiters.length === 0) {
      batchPromise = Promise.resolve();
      return;
    }

    onProviderCalled();
    const enrolled = waiters.slice();
    batchPromise = (async () => {
      try {
        const fresh = await assess(enrolled.map((item) => item.event));
        const byId = new Map(
          fresh.map((assessment) => [assessment.eventId, assessment]),
        );
        for (const waiter of enrolled) {
          const assessment = byId.get(waiter.event.id);
          if (!assessment) {
            waiter.reject(new AssessmentOmittedError(waiter.event.id));
            continue;
          }
          waiter.resolve({ assessment, assessedAt });
        }
      } catch (error) {
        onProviderFailed();
        for (const waiter of enrolled) {
          waiter.reject(error);
        }
      }
    })();
  };

  return {
    declareHit() {
      onNextHit();
      declared += 1;
      startBatchIfReady();
    },
    enroll(event: DetourEvent): Promise<AiAssessmentCacheEntry> {
      return new Promise<AiAssessmentCacheEntry>((resolve, reject) => {
        onNextMiss();
        waiters.push({ event, resolve, reject });
        declared += 1;
        startBatchIfReady();
      });
    },
    whenSettled(): Promise<void> {
      return batchPromise ?? Promise.resolve();
    },
  };
}

/**
 * Évalue la shortlist avec cache **per-event**.
 *
 * - Lookup mémoire par clé event
 * - Misses mémoire : `readThrough` (Next) ; seuls les compute exécutés
 *   sont batchés vers le provider
 * - Provider throw + cached (memory/Next) → partial
 * - 0 assessment → fallback
 * - Id omis → pas de cache pour cette key
 */
export async function assessHighlightsCached(params: {
  events: DetourEvent[];
  assess: (events: DetourEvent[]) => Promise<AiHighlightAssessment[]>;
  cacheContext: AiAssessmentCacheContext;
  force?: boolean;
  store?: AiAssessmentCacheStore;
  ttlMs?: number;
  readThrough?: (
    cacheKey: string,
    compute: () => Promise<AiAssessmentCacheEntry>,
  ) => Promise<AiAssessmentCacheEntry>;
  onForceInvalidate?: (cacheKey: string) => void | Promise<void>;
  now?: () => Date;
}): Promise<AssessHighlightsCachedResult> {
  const {
    events,
    assess,
    cacheContext,
    force = false,
    store = defaultMemoryStore,
    ttlMs = AI_ASSESSMENT_CACHE_TTL_MS,
    readThrough,
    onForceInvalidate,
    now = () => new Date(),
  } = params;

  if (events.length === 0) {
    return {
      assessments: [],
      source: "fallback",
      cacheHits: 0,
      cacheMisses: 0,
      cacheKey: null,
      assessedAt: null,
    };
  }

  const keyed = events.map((event) => ({
    event,
    key: eventCacheKey(event, cacheContext),
  }));

  if (force) {
    for (const { key } of keyed) {
      store.delete(key);
      await onForceInvalidate?.(key);
    }
  }

  const resolved = new Map<string, AiAssessmentCacheEntry>();
  const memoryMisses: Array<{ event: DetourEvent; key: string }> = [];

  for (const item of keyed) {
    if (!force) {
      const hit = store.get(item.key);
      if (hit) {
        resolved.set(item.event.id, hit);
        continue;
      }
    }
    memoryMisses.push(item);
  }

  let cacheHits = resolved.size;
  let cacheMisses = 0;
  let providerCalled = false;
  let providerFailed = false;

  if (memoryMisses.length > 0) {
    const assessedAt = now().toISOString();

    if (readThrough) {
      const batcher = createRequestScopedAssessmentBatcher({
        assess,
        assessedAt,
        totalLookups: memoryMisses.length,
        onProviderCalled: () => {
          providerCalled = true;
        },
        onProviderFailed: () => {
          providerFailed = true;
        },
        onNextHit: () => {
          cacheHits += 1;
        },
        onNextMiss: () => {
          cacheMisses += 1;
        },
      });

      await Promise.allSettled(
        memoryMisses.map(async ({ event, key }) => {
          let computeStarted = false;
          try {
            const entry = await readThrough(key, () => {
              computeStarted = true;
              return batcher.enroll(event);
            });
            if (!computeStarted) {
              batcher.declareHit();
            }
            store.set(key, entry, ttlMs);
            resolved.set(event.id, entry);
          } catch (error) {
            if (!computeStarted) {
              batcher.declareHit();
            }
            if (error instanceof AssessmentOmittedError) return;
          }
        }),
      );

      await batcher.whenSettled();
    } else {
      cacheMisses = memoryMisses.length;
      providerCalled = true;
      try {
        const fresh = await assess(memoryMisses.map((item) => item.event));
        const byId = new Map(
          fresh.map((assessment) => [assessment.eventId, assessment]),
        );
        for (const { event, key } of memoryMisses) {
          const assessment = byId.get(event.id);
          if (!assessment) continue;
          const entry: AiAssessmentCacheEntry = {
            assessment,
            assessedAt,
          };
          store.set(key, entry, ttlMs);
          resolved.set(event.id, entry);
        }
      } catch {
        providerFailed = true;
      }
    }
  }

  const assessments: AiHighlightAssessment[] = [];
  const assessedAtValues: string[] = [];
  for (const { event } of keyed) {
    const entry = resolved.get(event.id);
    if (!entry) continue;
    assessments.push(entry.assessment);
    assessedAtValues.push(entry.assessedAt);
  }

  return {
    assessments,
    source: resolveSource({
      cacheHits,
      assessmentCount: assessments.length,
      shortlistSize: events.length,
      providerCalled,
      providerFailed,
    }),
    cacheHits,
    cacheMisses,
    cacheKey: null,
    assessedAt:
      assessedAtValues.length > 0
        ? assessedAtValues.reduce((latest, value) =>
            value > latest ? value : latest,
          )
        : null,
  };
}
