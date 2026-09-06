import { unstable_cache } from "next/cache";
import {
  INGESTION_CACHE_TTL_SECONDS,
  type IngestionReadThrough,
  type SerializableIngestionResult,
} from "@/infrastructure/ingestion-cache";

/**
 * Next `unstable_cache` persiste tout succès de `compute`.
 * Pour respecter `cacheable: false` sans élargir le contrat public,
 * l’adapter Next convertit localement non-cacheable → throw non persisté.
 */
const NOT_CACHEABLE = "IngestionNotCacheable";

type NotCacheableError = Error & {
  name: typeof NOT_CACHEABLE;
  payload: SerializableIngestionResult;
};

function isNotCacheableError(error: unknown): error is NotCacheableError {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name: unknown }).name === NOT_CACHEABLE &&
    "payload" in error
  );
}

/** Read-through Next Data Cache pour l’ingestion Orléans+Saran. */
export function createNextIngestionReadThrough(): IngestionReadThrough {
  return async (cacheKey, compute) => {
    const cached = unstable_cache(
      async () => {
        const result = await compute();
        if (!result.cacheable) {
          const error = new Error(
            "Partial ingestion is not cacheable",
          ) as NotCacheableError;
          error.name = NOT_CACHEABLE;
          error.payload = result.payload;
          throw error;
        }
        return result.payload;
      },
      ["detour-ingestion", cacheKey],
      {
        revalidate: INGESTION_CACHE_TTL_SECONDS,
        tags: [ingestionCacheTag(cacheKey)],
      },
    );

    try {
      return await cached();
    } catch (error) {
      if (isNotCacheableError(error)) {
        return error.payload;
      }
      throw error;
    }
  };
}

export function ingestionCacheTag(cacheKey: string): string {
  return `detour-ingestion-${cacheKey}`;
}

/** Exposé pour typage / tests de forme — le payload doit rester JSON-safe. */
export type { SerializableIngestionResult };
