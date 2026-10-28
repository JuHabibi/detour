import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  ADD_FAVORITE_PARAM,
  clearPendingFavoriteIntent,
  extractPendingFavoriteIdFromPath,
  normalizePendingEventId,
  parsePendingFavoriteIntent,
  pathWithPendingFavorite,
  readPendingFavoriteIntent,
  resolvePendingFavoriteEventId,
  savePendingFavoriteIntent,
  stripPendingFavoriteFromPath,
} from "@/lib/pending-favorite";

describe("pending-favorite", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalise et rejette les ids invalides", () => {
    expect(normalizePendingEventId("  e1  ")).toBe("e1");
    expect(normalizePendingEventId("")).toBeNull();
    expect(normalizePendingEventId("   ")).toBeNull();
    expect(normalizePendingEventId(null)).toBeNull();
  });

  it("encode addFavorite dans un chemin sûr", () => {
    expect(pathWithPendingFavorite("openagenda:1", "/")).toBe(
      `/?${ADD_FAVORITE_PARAM}=openagenda%3A1`,
    );
    expect(pathWithPendingFavorite("e1", "/#detour")).toBe(
      `/?${ADD_FAVORITE_PARAM}=e1#detour`,
    );
    expect(pathWithPendingFavorite("e1", "/explorer")).toBe(
      `/explorer?${ADD_FAVORITE_PARAM}=e1`,
    );
    expect(pathWithPendingFavorite("", "/frise")).toBe("/frise");
  });

  it("extrait et retire le paramètre", () => {
    expect(
      extractPendingFavoriteIdFromPath("/?addFavorite=e1&x=1"),
    ).toBe("e1");
    expect(stripPendingFavoriteFromPath("/?addFavorite=e1&x=1")).toBe(
      "/?x=1",
    );
    expect(stripPendingFavoriteFromPath("//evil.test")).toBe("/");
  });

  it("persiste et lit l’intention session (confirmation e-mail)", () => {
    expect(savePendingFavoriteIntent("e1", "/")).toBe(true);
    const intent = readPendingFavoriteIntent();
    expect(intent?.eventId).toBe("e1");
    expect(intent?.returnPath).toContain("addFavorite=e1");
    clearPendingFavoriteIntent();
    expect(readPendingFavoriteIntent()).toBeNull();
  });

  it("rejette un payload session invalide", () => {
    expect(parsePendingFavoriteIntent({ v: 2, eventId: "e1" })).toBeNull();
    expect(parsePendingFavoriteIntent("nope")).toBeNull();
  });

  it("priorise l’URL sur le stockage session", () => {
    savePendingFavoriteIntent("from-storage", "/");
    const params = new URLSearchParams("addFavorite=from-url");
    expect(resolvePendingFavoriteEventId(params)).toBe("from-url");
    expect(resolvePendingFavoriteEventId(new URLSearchParams())).toBe(
      "from-storage",
    );
  });
});
