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
      audience: null,
    };
    const qs = serializeExplorerUrlState(state);
    expect(qs).toContain("when=today");
    expect(qs).toContain("q=jazz");
    expect(qs).toContain("city=Orl");
    expect(qs).toContain("category=Musique");
    expect(qs).not.toContain("audience=");
    expect(parseExplorerUrlState(Object.fromEntries(new URLSearchParams(qs)))).toEqual(
      state,
    );
  });

  it("round-trip audience=jeune_public + category Spectacle", () => {
    const state = {
      when: "weekend" as const,
      from: null,
      to: null,
      q: "",
      city: null,
      category: "Spectacle" as const,
      audience: "jeune_public" as const,
    };
    const qs = serializeExplorerUrlState(state);
    expect(qs).toContain("category=Spectacle");
    expect(qs).toContain("audience=jeune_public");
    expect(parseExplorerUrlState(Object.fromEntries(new URLSearchParams(qs)))).toEqual(
      state,
    );
  });

  it("alias category=jeune_public → type historique Jeune public (pas audience)", () => {
    expect(parseExplorerUrlState({ category: "jeune_public" })).toEqual({
      ...EXPLORER_URL_DEFAULTS,
      category: "Jeune public",
      audience: null,
    });
  });

  it("sérialise Jeune public en libellé canon, jamais le slug audience", () => {
    const qs = serializeExplorerUrlState({
      ...EXPLORER_URL_DEFAULTS,
      category: "Jeune public",
    });
    expect(qs).toContain("category=Jeune");
    expect(qs).not.toContain("category=jeune_public");
  });

  it("category=Jeune public historique : parse inchangé, sans audience", () => {
    // URLSearchParams décode déjà Jeune%20public → "Jeune public".
    expect(parseExplorerUrlState({ category: "Jeune public" })).toEqual({
      ...EXPLORER_URL_DEFAULTS,
      category: "Jeune public",
      audience: null,
    });
  });

  it("round-trip range", () => {
    const state = {
      when: "range" as const,
      from: "2026-03-12",
      to: "2026-03-14",
      q: "",
      city: null,
      category: "tout" as const,
      audience: null,
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
