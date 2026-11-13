import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RadarCommitment } from "@/application/home/radar-commitment";

/**
 * Miroir Next 16 — clé réelle :
 *   fixedKey = `${cb.toString()}-${keyParts.join(",")}`
 *   invocationKey = `${fixedKey}-${JSON.stringify(args)}`
 * Throw dans le callback → pas d’écriture (comme cacheNewResult omis).
 */
const dataCache = new Map<string, RadarCommitment>();

function nextInvocationKey(
  cb: (...args: never[]) => unknown,
  keyParts: unknown[],
  args: unknown[],
): string {
  const fixedKey = `${cb.toString()}-${(keyParts as string[]).join(",")}`;
  return `${fixedKey}-${JSON.stringify(args)}`;
}

const unstable_cache = vi.fn(
  (cb: (...args: never[]) => Promise<RadarCommitment>, keyParts: unknown[]) => {
    return async (...args: unknown[]) => {
      const key = nextInvocationKey(cb, keyParts, args);
      if (dataCache.has(key)) return dataCache.get(key)!;
      const value = await cb(...(args as never[]));
      dataCache.set(key, value);
      return value;
    };
  },
);

vi.mock("next/cache", () => ({
  unstable_cache,
}));

const sampleCommitment = (): RadarCommitment => ({
  items: [
    {
      eventId: "e1",
      score: 5,
      planningScore: 1,
      reasons: ["high-appeal"],
    },
  ],
  aiAssessments: [
    {
      eventId: "e1",
      appeal: 4,
      missRisk: 3,
      planningNeed: 3,
      localRarity: 2,
      likelyDemand: 3,
      confidence: 0.9,
      reasons: ["test"],
    },
  ],
});

describe("createNextRadarCommitmentStore — clé Next réelle", () => {
  beforeEach(() => {
    dataCache.clear();
    unstable_cache.mockClear();
    vi.resetModules();
  });

  it("deux lambdas distinctes + mêmes keyParts ⇒ entrées différentes (bug P1)", async () => {
    const keyParts = ["detour-radar-commitment", "v1", "hash"];
    const writeCb = async () => sampleCommitment();
    const readCb = async (): Promise<RadarCommitment> => {
      throw new Error("RADAR_COMMITMENT_CACHE_MISS");
    };

    expect(
      nextInvocationKey(writeCb, keyParts, []),
    ).not.toEqual(nextInvocationKey(readCb, keyParts, []));
  });

  it("write puis read via deux instances du store ⇒ HIT (même fonction nommée)", async () => {
    const { createNextRadarCommitmentStore, loadRadarCommitmentCached } =
      await import("@/infrastructure/ai/next-radar-commitment-cache");

    const storeA = createNextRadarCommitmentStore();
    const storeB = createNextRadarCommitmentStore();
    const hash = "snapshot-hash-shared";
    const commitment = sampleCommitment();

    await storeA.write(hash, commitment);
    expect(dataCache.size).toBe(1);

    // Deuxième instance : même cb.toString() + mêmes args ⇒ même entrée
    const read = await storeB.read(hash);
    expect(read).toEqual(commitment);

    const keys = [...dataCache.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain(loadRadarCommitmentCached.toString());
    expect(keys[0]).toContain(hash);
  });

  it("miss + throw → null, aucune entrée ; write ensuite lisible", async () => {
    const { createNextRadarCommitmentStore } = await import(
      "@/infrastructure/ai/next-radar-commitment-cache"
    );
    const store = createNextRadarCommitmentStore();
    const hash = "abc123";

    expect(await store.read(hash)).toBeNull();
    expect(dataCache.size).toBe(0);

    const commitment = sampleCommitment();
    await store.write(hash, commitment);
    expect(await store.read(hash)).toEqual(commitment);
  });

  it("erreur inattendue en read → null (Home ne tombe pas)", async () => {
    unstable_cache.mockImplementationOnce(() => async () => {
      throw new Error("boom");
    });
    const { createNextRadarCommitmentStore } = await import(
      "@/infrastructure/ai/next-radar-commitment-cache"
    );
    const store = createNextRadarCommitmentStore();
    expect(await store.read("x")).toBeNull();
  });
});
