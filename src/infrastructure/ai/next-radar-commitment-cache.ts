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

/**
 * Next compose la clé ainsi :
 *   fixedKey = `${cb.toString()}-${keyParts.join(",")}`
 *   invocationKey = `${fixedKey}-${JSON.stringify(args)}`
 * Deux lambdas différentes ⇒ deux entrées, même si keyParts sont identiques.
 * Une seule fonction nommée + les mêmes args ⇒ la même entrée.
 */
export const RADAR_COMMITMENT_CACHE_KEY_PREFIX = [
  "detour-radar-commitment",
  "v1",
] as const;

/**
 * Canal d’écriture request-local : le compute ne reçoit le payload qu’au miss
 * d’un `write`. Ce n’est pas un cache de vérité — le Data Cache Next l’est.
 * Obligatoire car `unstable_cache` inclut les args dans la clé : on ne peut pas
 * passer le commitment en argument sans diverger de la clé de `read`.
 */
const writePayloadByHash = new Map<string, RadarCommitment>();

/**
 * Callback unique read/write — `toString()` stable, args = `(snapshotHash)`.
 */
export async function loadRadarCommitmentCached(
  snapshotHash: string,
): Promise<RadarCommitment> {
  const pending = writePayloadByHash.get(snapshotHash);
  if (pending) return pending;
  throw new RadarCommitmentCacheMissError();
}

/** Exposé pour tests : formule d’invocation Next 16. */
export function buildRadarCommitmentInvocationKey(
  cb: (...args: never[]) => unknown,
  keyParts: readonly string[],
  args: unknown[],
): string {
  const fixedKey = `${cb.toString()}-${keyParts.join(",")}`;
  return `${fixedKey}-${JSON.stringify(args)}`;
}

function cachedCommitment(snapshotHash: string): Promise<RadarCommitment> {
  return unstable_cache(
    loadRadarCommitmentCached,
    [...RADAR_COMMITMENT_CACHE_KEY_PREFIX],
    {
      tags: [RADAR_COMMITMENT_CACHE_TAG],
      revalidate: RADAR_COMMITMENT_REVALIDATE_SECONDS,
    },
  )(snapshotHash);
}

/**
 * Data Cache sibling du snapshot Home (même tag → invalidation sync cohérente).
 *
 * - Même fonction nommée + mêmes keyParts + même arg `snapshotHash` pour read/write.
 * - `read` miss → throw non persisté → null (pas de baseline écrite).
 * - `write` dépose le payload dans le canal, puis miss cache → compute renvoie
 *   le commitment et Next le persiste.
 * - `unstable_cache` n’est appelé qu’au read/write (pas au import module).
 */
export function createNextRadarCommitmentStore(): RadarCommitmentStore {
  return {
    async read(snapshotHash) {
      try {
        return await cachedCommitment(snapshotHash);
      } catch (error) {
        if (isRadarCommitmentCacheMiss(error)) return null;
        console.error("[detour] radar commitment read failed", error);
        return null;
      }
    },

    async write(snapshotHash, commitment) {
      writePayloadByHash.set(snapshotHash, commitment);
      try {
        return await cachedCommitment(snapshotHash);
      } finally {
        writePayloadByHash.delete(snapshotHash);
      }
    },
  };
}
