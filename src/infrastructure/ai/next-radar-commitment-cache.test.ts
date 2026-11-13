import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RadarCommitment } from "@/application/home/radar-commitment";

const cache = new Map<string, RadarCommitment>();

/**
 * Miroir Next 16 : throw dans le callback → pas d’écriture cache.
 * HIT renvoie la valeur sans rejouer le compute.
 */
const unstable_cache = vi.fn(
  (compute: () => Promise<RadarCommitment>, keyParts: unknown[]) => {
    const key = JSON.stringify(keyParts);
    return async () => {
      if (cache.has(key)) return cache.get(key)!;
      const value = await compute();
      cache.set(key, value);
      return value;
    };
  },
);

vi.mock("next/cache", () => ({
  unstable_cache,
}));

describe("createNextRadarCommitmentStore", () => {
  beforeEach(() => {
    cache.clear();
    unstable_cache.mockClear();
  });

  it("miss + throw → null, aucune entrée persistée ; write puis read → HIT", async () => {
    const { createNextRadarCommitmentStore } = await import(
      "@/infrastructure/ai/next-radar-commitment-cache"
    );
    const store = createNextRadarCommitmentStore();
    const hash = "abc123";

    expect(await store.read(hash)).toBeNull();
    expect(cache.size).toBe(0);

    const commitment: RadarCommitment = {
      items: [
        {
          eventId: "e1",
          score: 5,
          planningScore: 1,
          reasons: ["high-appeal"],
        },
      ],
    };
    await store.write(hash, commitment);
    expect(cache.size).toBe(1);

    expect(await store.read(hash)).toEqual(commitment);
    // Second read : HIT (compute throw non rejoué pour ce key)
    expect(await store.read(hash)).toEqual(commitment);
  });

  it("erreur inattendue en read → null (Home ne tombe pas)", async () => {
    const { createNextRadarCommitmentStore } = await import(
      "@/infrastructure/ai/next-radar-commitment-cache"
    );
    unstable_cache.mockImplementationOnce(() => async () => {
      throw new Error("boom");
    });
    const store = createNextRadarCommitmentStore();
    expect(await store.read("x")).toBeNull();
  });
});
