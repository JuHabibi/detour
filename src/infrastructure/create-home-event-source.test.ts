import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createNextIngestionReadThrough,
  databaseCtor,
} = vi.hoisted(() => ({
  createNextIngestionReadThrough: vi.fn(() => ({ kind: "readThrough" })),
  databaseCtor: vi.fn(function DatabaseEventSourceAdapter(this: {
    kind: string;
  }) {
    this.kind = "database";
  }),
}));

vi.mock("@/infrastructure/next-ingestion-cache", () => ({
  createNextIngestionReadThrough: () => createNextIngestionReadThrough(),
}));

vi.mock("@/infrastructure/sources/database/database-event-source.adapter", () => ({
  DatabaseEventSourceAdapter: databaseCtor,
}));

vi.mock("@/infrastructure/ingestion-cache", async () => {
  const actual = await vi.importActual<
    typeof import("@/infrastructure/ingestion-cache")
  >("@/infrastructure/ingestion-cache");
  return {
    ...actual,
    wrapWithIngestionCache: vi.fn((inner: unknown) => ({
      kind: "cached",
      inner,
    })),
  };
});

import { createHomeEventSource } from "@/infrastructure/create-detour-event-source";

describe("createHomeEventSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DETOUR_EVENT_SOURCE;
  });

  afterEach(() => {
    delete process.env.DETOUR_EVENT_SOURCE;
  });

  it("database : DB adapter uniquement, pas de readThrough live", () => {
    process.env.DETOUR_EVENT_SOURCE = "database";
    const source = createHomeEventSource() as unknown as { kind: string };
    expect(source.kind).toBe("database");
    expect(databaseCtor).toHaveBeenCalledTimes(1);
    expect(createNextIngestionReadThrough).not.toHaveBeenCalled();
  });

  it("live : construit cached + readThrough", () => {
    process.env.DETOUR_EVENT_SOURCE = "live";
    const source = createHomeEventSource() as unknown as { kind: string };
    expect(source.kind).toBe("cached");
    expect(createNextIngestionReadThrough).toHaveBeenCalledTimes(1);
    expect(databaseCtor).not.toHaveBeenCalled();
  });

  it("défaut (absent) : live", () => {
    const source = createHomeEventSource() as unknown as { kind: string };
    expect(source.kind).toBe("cached");
    expect(createNextIngestionReadThrough).toHaveBeenCalledTimes(1);
    expect(databaseCtor).not.toHaveBeenCalled();
  });

  it("valeur invalide : throw avant toute construction", () => {
    process.env.DETOUR_EVENT_SOURCE = "postgres";
    expect(() => createHomeEventSource()).toThrow(/Invalid DETOUR_EVENT_SOURCE/);
    expect(createNextIngestionReadThrough).not.toHaveBeenCalled();
    expect(databaseCtor).not.toHaveBeenCalled();
  });
});
