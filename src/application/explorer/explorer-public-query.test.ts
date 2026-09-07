import { describe, expect, it } from "vitest";
import {
  categoryIdToExplorerFilter,
  cityToExplorerFilter,
  isStaleExplorerRequest,
  parseExplorerPublicInput,
} from "@/application/explorer/explorer-public-query";
import { V1_COMMUNES } from "@/domain/geo/v1-communes";

describe("categoryIdToExplorerFilter", () => {
  it('"tout" → undefined (pas de filtre)', () => {
    expect(categoryIdToExplorerFilter("tout")).toBeUndefined();
  });

  it("catégorie produit → valeur backend", () => {
    expect(categoryIdToExplorerFilter("Musique")).toBe("Musique");
  });
});

describe("cityToExplorerFilter", () => {
  it("null → undefined (toutes les villes)", () => {
    expect(cityToExplorerFilter(null)).toBeUndefined();
  });

  it("commune V1 → valeur backend", () => {
    expect(cityToExplorerFilter("Orléans")).toBe("Orléans");
  });
});

describe("parseExplorerPublicInput", () => {
  it("page initiale weekend sans filtres", () => {
    const parsed = parseExplorerPublicInput({ when: "weekend" });
    expect(parsed).toEqual({
      ok: true,
      query: {
        when: "weekend",
        search: undefined,
        category: undefined,
        city: undefined,
        cursor: undefined,
        limit: 12,
      },
    });
  });

  it("rejette when / category / city invalides", () => {
    expect(parseExplorerPublicInput({ when: "never" }).ok).toBe(false);
    expect(
      parseExplorerPublicInput({ when: "weekend", category: "Metal" }).ok,
    ).toBe(false);
    expect(
      parseExplorerPublicInput({ when: "weekend", city: "Tours" }).ok,
    ).toBe(false);
  });

  it("accepte category + city V1 + search + cursor", () => {
    const parsed = parseExplorerPublicInput({
      when: "today",
      search: "jazz",
      category: "Musique",
      city: "Saran",
      cursor: "abc",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.category).toBe("Musique");
    expect(parsed.query.city).toBe("Saran");
    expect(parsed.query.search).toBe("jazz");
    expect(parsed.query.cursor).toBe("abc");
    expect(V1_COMMUNES).toContain(parsed.query.city);
  });

  it('"tout" et city vide = pas de filtre', () => {
    const parsed = parseExplorerPublicInput({
      when: "weekend",
      category: "tout",
      city: "",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.category).toBeUndefined();
    expect(parsed.query.city).toBeUndefined();
  });
});

describe("isStaleExplorerRequest", () => {
  it("ignore une réponse obsolète", () => {
    expect(isStaleExplorerRequest(1, 2)).toBe(true);
    expect(isStaleExplorerRequest(2, 2)).toBe(false);
  });
});
