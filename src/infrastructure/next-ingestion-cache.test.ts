import { beforeEach, describe, expect, it, vi } from "vitest";

const unstable_cache = vi.fn(
  (compute: () => Promise<unknown>) => async () => compute(),
);

vi.mock("next/cache", () => ({
  unstable_cache,
}));

describe("createNextIngestionReadThrough cacheable flag", () => {
  beforeEach(() => {
    unstable_cache.mockClear();
  });

  it("cacheable=false → retourne le payload sans succès cacheable", async () => {
    const { createNextIngestionReadThrough } = await import(
      "@/infrastructure/next-ingestion-cache"
    );

    const readThrough = createNextIngestionReadThrough();
    const payload = {
      events: [],
      adapterByEventId: [] as Array<[string, string]>,
      rawCountByAdapter: [["orleans", 0]] as Array<[string, number]>,
      statusByAdapter: [["orleans", "error"]] as Array<[string, "ok" | "error"]>,
      sourceNameByAdapter: [["orleans", "Orléans"]] as Array<[string, string]>,
      adapterOrder: ["orleans"],
    };

    const result = await readThrough("key", async () => ({
      payload,
      cacheable: false,
    }));

    expect(result).toEqual(payload);
    expect(unstable_cache).toHaveBeenCalledTimes(1);
  });

  it("cacheable=true → retourne le payload via unstable_cache", async () => {
    const { createNextIngestionReadThrough } = await import(
      "@/infrastructure/next-ingestion-cache"
    );

    const readThrough = createNextIngestionReadThrough();
    const payload = {
      events: [],
      adapterByEventId: [] as Array<[string, string]>,
      rawCountByAdapter: [["orleans", 0]] as Array<[string, number]>,
      statusByAdapter: [["orleans", "ok"]] as Array<[string, "ok" | "error"]>,
      sourceNameByAdapter: [["orleans", "Orléans"]] as Array<[string, string]>,
      adapterOrder: ["orleans"],
    };

    const result = await readThrough("key", async () => ({
      payload,
      cacheable: true,
    }));

    expect(result).toEqual(payload);
  });
});
