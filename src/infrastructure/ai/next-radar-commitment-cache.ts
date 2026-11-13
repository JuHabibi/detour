import { unstable_cache } from "next/cache";
import type {
  RadarCommitment,
  RadarCommitmentStore,
} from "@/application/home/radar-commitment";
import { PUBLIC_TERRITORY_SLUG } from "@/config/public-territory";

/** Aligné sur `PUBLIC_HOME_CACHE_TAG` — invalidation sync partagée. */
const RADAR_COMMITMENT_CACHE_TAG = `public-home:${PUBLIC_TERRITORY_SLUG}`;
const RADAR_COMMITMENT_REVALIDATE_SECONDS = 60 * 60 * 6;

/**
 * Sentinel de miss — volontairement throw.
 * Next 16 n’appelle `cacheNewResult` que si le callback résout : un throw
 * n’enregistre donc jamais d’entrée (ni baseline dégradée).
 * @see node_modules/next/dist/server/web/spec-extension/unstable-cache.js
 */
export class RadarCommitmentCacheMissError extends Error {
  constructor() {
    super("RADAR_COMMITMENT_CACHE_MISS");
    this.name = "RadarCommitmentCacheMissError";
  }
}

export function isRadarCommitmentCacheMiss(error: unknown): boolean {
  if (error instanceof RadarCommitmentCacheMissError) return true;
  if (!(error instanceof Error)) return false;
  return (
    error.name === "RadarCommitmentCacheMissError" ||
    error.message === "RADAR_COMMITMENT_CACHE_MISS"
  );
}

function commitmentCacheKeyParts(snapshotHash: string): string[] {
  return ["detour-radar-commitment", "v1", snapshotHash];
}

/**
 * Data Cache sibling du snapshot Home (même tag → invalidation sync cohérente).
 *
 * Limite Next documentée : `unstable_cache` ne distingue pas HIT/MISS.
 * - `read` : callback qui throw sur miss → HIT renvoie le commitment, MISS → null
 *   (throw non persisté). Permet de **skip l’IA** si un commitment existe.
 * - `write` : n’appeler qu’avec une sélection IA committable.
 */
export function createNextRadarCommitmentStore(): RadarCommitmentStore {
  return {
    async read(snapshotHash) {
      try {
        return await unstable_cache(
          async (): Promise<RadarCommitment> => {
            throw new RadarCommitmentCacheMissError();
          },
          commitmentCacheKeyParts(snapshotHash),
          {
            tags: [RADAR_COMMITMENT_CACHE_TAG],
            revalidate: RADAR_COMMITMENT_REVALIDATE_SECONDS,
          },
        )();
      } catch (error) {
        if (isRadarCommitmentCacheMiss(error)) return null;
        // Home ne doit pas tomber : traiter comme miss.
        console.error("[detour] radar commitment read failed", error);
        return null;
      }
    },

    async write(snapshotHash, commitment) {
      return unstable_cache(
        async () => commitment,
        commitmentCacheKeyParts(snapshotHash),
        {
          tags: [RADAR_COMMITMENT_CACHE_TAG],
          revalidate: RADAR_COMMITMENT_REVALIDATE_SECONDS,
        },
      )();
    },
  };
}
