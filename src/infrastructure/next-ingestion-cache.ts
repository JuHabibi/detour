import { unstable_cache } from "next/cache";
import {
  INGESTION_CACHE_TTL_SECONDS,
  type IngestionReadThrough,
  type SerializableIngestionResult,
} from "@/infrastructure/ingestion-cache";

/** Read-through Next Data Cache pour l’ingestion Orléans+Saran. */
export function createNextIngestionReadThrough(): IngestionReadThrough {
  return (cacheKey, compute) => {
    const cached = unstable_cache(
      compute,
      ["detour-ingestion", cacheKey],
      {
        revalidate: INGESTION_CACHE_TTL_SECONDS,
        tags: [ingestionCacheTag(cacheKey)],
      },
    );
    return cached();
  };
}

export function ingestionCacheTag(cacheKey: string): string {
  return `detour-ingestion-${cacheKey}`;
}

/** Exposé pour typage / tests de forme — le payload doit rester JSON-safe. */
export type { SerializableIngestionResult };
