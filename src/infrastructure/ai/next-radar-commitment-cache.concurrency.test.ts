import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RadarCommitment } from "@/application/home/radar-commitment";

/**
 * Miroir Next 16 (clé + throw non persisté).
 * Permet de gater le compute pour imposer des interleavings.
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

function commitment(id: string): RadarCommitment {
  return {
    items: [
      {
        eventId: id,
        score: 5,
        planningScore: 1,
        reasons: ["high-appeal"],
      },
    ],
    aiAssessments: [],
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("radar commitment — courses sur writePayloadByHash (P1)", () => {
  beforeEach(() => {
    dataCache.clear();
    unstable_cache.mockClear();
    vi.resetModules();
  });

  afterEach(async () => {
    const { radarCommitmentConcurrencyHooks } = await import(
      "@/infrastructure/ai/next-radar-commitment-cache"
    );
    radarCommitmentConcurrencyHooks.beforeReadPayload = null;
  });

  it("read concurrent observe un payload de write non encore terminé", async () => {
    const { createNextRadarCommitmentStore, radarCommitmentConcurrencyHooks } =
      await import("@/infrastructure/ai/next-radar-commitment-cache");

    const gate = deferred();
    radarCommitmentConcurrencyHooks.beforeReadPayload = () => gate.promise;

    const store = createNextRadarCommitmentStore();
    const hash = "race-read-write";
    const payload = commitment("WRITE_A");

    let writeDone = false;
    const writePromise = store.write(hash, payload).then((value) => {
      writeDone = true;
      return value;
    });

    // Laisser write poser le Map et bloquer dans loadRadarCommitmentCached.
    await Promise.resolve();
    await Promise.resolve();

    radarCommitmentConcurrencyHooks.beforeReadPayload = null;
    const readDuringWrite = store.read(hash);

    // Le read ne doit pas pouvoir obtenir le commitment tant que write n’a
    // pas fini — or avec le Map global, il le voit et le persiste.
    const readResult = await readDuringWrite;
    expect(writeDone).toBe(false);
    expect(readResult).toEqual(payload);

    gate.resolve();
    await writePromise;
  });

  it("deux write concurrents : finally de A peut faire échouer B", async () => {
    const { createNextRadarCommitmentStore, radarCommitmentConcurrencyHooks } =
      await import("@/infrastructure/ai/next-radar-commitment-cache");

    const gateA = deferred();
    let hitA = false;

    radarCommitmentConcurrencyHooks.beforeReadPayload = async () => {
      if (!hitA) {
        hitA = true;
        await gateA.promise;
        return;
      }
      // B : laisser A finir (finally clear Map) avant de lire le payload
      await Promise.resolve();
    };

    const store = createNextRadarCommitmentStore();
    const hash = "race-write-write";
    const payloadA = commitment("A");
    const payloadB = commitment("B");

    const writeA = store.write(hash, payloadA);

    await Promise.resolve();
    await Promise.resolve();

    // B écrase le Map pendant que A est encore dans load (gateA).
    const writeBPromise = store.write(hash, payloadB);

    // A reprend : lit le Map (possiblement B), cache, finally delete.
    gateA.resolve();
    const resultA = await writeA;

    // B peut maintenant entrer dans load avec Map déjà clear par finally de A.
    const resultB = await writeBPromise.catch((error: unknown) => error);

    // Au moins une violation : soit B a échoué (miss), soit le cache n’a pas B
    // alors que B pensait écrire, soit A a persisté B à la place de A.
    const cached = await store.read(hash);
    const bFailed =
      resultB instanceof Error ||
      (resultB &&
        typeof resultB === "object" &&
        "name" in resultB &&
        (resultB as { name: string }).name === "RadarCommitmentCacheMissError");

    const interference =
      bFailed ||
      cached?.items[0]?.eventId !== "B" ||
      resultA.items[0]?.eventId !== "A";

    expect(interference).toBe(true);
  });
});
