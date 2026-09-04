import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/event";
import { buildAiAssessmentCacheKey } from "@/infrastructure/ai/ai-assessment-cache-key";

/** TTL POC : 6 heures. */
export const AI_ASSESSMENT_CACHE_TTL_SECONDS = 6 * 60 * 60;
export const AI_ASSESSMENT_CACHE_TTL_MS = AI_ASSESSMENT_CACHE_TTL_SECONDS * 1000;

export type AiAssessmentCacheEntry = {
  assessments: AiHighlightAssessment[];
  assessedAt: string;
};

export type AiAssessmentCacheSource = "fresh" | "cache" | "fallback";

export type AssessHighlightsCachedResult = {
  assessments: AiHighlightAssessment[];
  source: AiAssessmentCacheSource;
  cacheKey: string;
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

/**
 * Évalue la shortlist avec cache.
 * - force=true : ignore le cache, nouvel appel provider
 * - hit store → source "cache"
 * - miss → appel provider → source "fresh"
 * - erreur / vide → source "fallback"
 *
 * `readThrough` : couche optionnelle (Next `unstable_cache`). Doit appeler
 * `compute` uniquement en cas de miss Data Cache. On détecte fresh vs cache
 * via un compteur d’appels à compute.
 */
export async function assessHighlightsCached(params: {
  events: DetourEvent[];
  assess: (events: DetourEvent[]) => Promise<AiHighlightAssessment[]>;
  force?: boolean;
  store?: AiAssessmentCacheStore;
  ttlMs?: number;
  readThrough?: (
    cacheKey: string,
    compute: () => Promise<AiAssessmentCacheEntry>,
  ) => Promise<AiAssessmentCacheEntry>;
  onForceInvalidate?: (cacheKey: string) => void | Promise<void>;
}): Promise<AssessHighlightsCachedResult> {
  const {
    events,
    assess,
    force = false,
    store = defaultMemoryStore,
    ttlMs = AI_ASSESSMENT_CACHE_TTL_MS,
    readThrough,
    onForceInvalidate,
  } = params;

  const cacheKey = buildAiAssessmentCacheKey(events);

  if (events.length === 0) {
    return {
      assessments: [],
      source: "fallback",
      cacheKey,
      assessedAt: null,
    };
  }

  if (!force) {
    const hit = store.get(cacheKey);
    if (hit) {
      return {
        assessments: hit.assessments,
        source: "cache",
        cacheKey,
        assessedAt: hit.assessedAt,
      };
    }
  } else {
    store.delete(cacheKey);
    await onForceInvalidate?.(cacheKey);
  }

  try {
    let computeCalls = 0;
    const compute = async (): Promise<AiAssessmentCacheEntry> => {
      computeCalls += 1;
      const assessments = await assess(events);
      return {
        assessments,
        assessedAt: new Date().toISOString(),
      };
    };

    const entry =
      !force && readThrough
        ? await readThrough(cacheKey, compute)
        : await compute();

    if (!entry.assessments.length) {
      return {
        assessments: [],
        source: "fallback",
        cacheKey,
        assessedAt: entry.assessedAt,
      };
    }

    store.set(cacheKey, entry, ttlMs);

    return {
      assessments: entry.assessments,
      source: computeCalls > 0 ? "fresh" : "cache",
      cacheKey,
      assessedAt: entry.assessedAt,
    };
  } catch {
    return {
      assessments: [],
      source: "fallback",
      cacheKey,
      assessedAt: null,
    };
  }
}
