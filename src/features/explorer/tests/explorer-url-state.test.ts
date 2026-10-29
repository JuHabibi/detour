import { describe, expect, it } from "vitest";
import {
  EXPLORER_URL_DEFAULTS,
  explorerUrlHref,
  parseExplorerUrlState,
  serializeExplorerUrlState,
} from "@/features/explorer/explorer-url-state";

describe("explorer-url-state", () => {
  it("parse défaut → weekend", () => {
    expect(parseExplorerUrlState({})).toEqual(EXPLORER_URL_DEFAULTS);
  });

  it("round-trip preset + ville + catégorie + q", () => {
    const state = {
      when: "today" as const,
      from: null,
      to: null,
      q: "jazz",
      city: "Orléans" as const,
      category: "Musique" as const,
    };
    const qs = serializeExplorerUrlState(state);
    expect(qs).toContain("when=today");
    expect(qs).toContain("q=jazz");
    expect(qs).toContain("city=Orl");
    expect(qs).toContain("category=Musique");
    expect(parseExplorerUrlState(Object.fromEntries(new URLSearchParams(qs)))).toEqual(
      state,
    );
  });

  it("round-trip range", () => {
    const state = {
      when: "range" as const,
      from: "2026-03-12",
      to: "2026-03-14",
      q: "",
      city: null,
      category: "tout" as const,
    };
    const href = explorerUrlHref(state);
    expect(href).toBe(
      "/explorer?when=range&from=2026-03-12&to=2026-03-14",
    );
    const qs = href.split("?")[1] ?? "";
    expect(parseExplorerUrlState(Object.fromEntries(new URLSearchParams(qs)))).toEqual(
      state,
    );
  });

  it("range invalide → fallback weekend", () => {
    expect(
      parseExplorerUrlState({ when: "range", from: "2026-03-14", to: "2026-03-12" }),
    ).toEqual(EXPLORER_URL_DEFAULTS);
  });

  it("weekend défaut omis de l’URL", () => {
    expect(serializeExplorerUrlState(EXPLORER_URL_DEFAULTS)).toBe("");
    expect(explorerUrlHref(EXPLORER_URL_DEFAULTS)).toBe("/explorer");
  });
});
