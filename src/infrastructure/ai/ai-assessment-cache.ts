import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/event";
import {
  buildAiAssessmentEventCacheKey,
  type AiAssessmentGenerationConfig,
} from "@/infrastructure/ai/ai-assessment-cache-key";

/** TTL POC : 6 heures. */
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

export type AiAssessmentCacheContext = {
  model: string;
  promptVersion: string;
  generation: AiAssessmentGenerationConfig;
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
  providerCalled: boolean;
  providerFailed: boolean;
}): AiAssessmentCacheSource {
  const { cacheHits, assessmentCount, providerCalled, providerFailed } =
    params;

  if (assessmentCount === 0) return "fallback";
  if (providerFailed && cacheHits > 0) return "partial";
  if (!providerCalled) return "cache";
  if (cacheHits === 0) return "fresh";
  return "partial";
}

class AssessmentOmittedError extends Error {
  constructor(eventId: string) {
    super(`AI assessment omitted for ${eventId}`);
    this.name = "AssessmentOmittedError";
  }
}

/**
 * Évalue la shortlist avec cache **per-event**.
 *
 * - Lookup mémoire par clé event
 * - Misses : un seul `assess(misses)` (batching provider inchangé)
 * - `readThrough` (Next) : hydratation / peuplement via batch partagé
 *   (jamais 1 appel API par clé)
 * - Provider throw + cached → partial
 * - 0 assessment → fallback
 * - Id omis → pas de cache
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

  const cacheHits = resolved.size;
  const cacheMisses = memoryMisses.length;
  let providerCalled = false;
  let providerFailed = false;

  if (memoryMisses.length > 0) {
    const assessedAt = now().toISOString();

    if (readThrough) {
      let sharedBatch: Promise<Map<string, AiAssessmentCacheEntry>> | null =
        null;

      const ensureBatch = () => {
        if (!sharedBatch) {
          providerCalled = true;
          sharedBatch = assess(memoryMisses.map((item) => item.event)).then(
            (fresh) => {
              const map = new Map<string, AiAssessmentCacheEntry>();
              for (const assessment of fresh) {
                map.set(assessment.eventId, { assessment, assessedAt });
              }
              return map;
            },
          );
        }
        return sharedBatch;
      };

      const settlements = await Promise.allSettled(
        memoryMisses.map(async ({ event, key }) => {
          const entry = await readThrough(key, async () => {
            const map = await ensureBatch();
            const found = map.get(event.id);
            if (!found) throw new AssessmentOmittedError(event.id);
            return found;
          });
          store.set(key, entry, ttlMs);
          resolved.set(event.id, entry);
        }),
      );

      if (sharedBatch) {
        const batchResult = await Promise.allSettled([sharedBatch]);
        if (batchResult[0]?.status === "rejected") {
          providerFailed = true;
        }
      }

      for (const settlement of settlements) {
        if (settlement.status === "rejected") {
          const reason = settlement.reason;
          if (reason instanceof AssessmentOmittedError) continue;
          // Erreurs hors omit : si le batch a échoué, déjà providerFailed.
          // Sinon ignorer (event sans assessment).
        }
      }
    } else {
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
