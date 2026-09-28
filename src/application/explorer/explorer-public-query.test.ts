import { describe, expect, it } from "vitest";
import {
  categoryIdToExplorerFilter,
  cityToExplorerFilter,
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

  it("accepte limit plafonné", () => {
    const parsed = parseExplorerPublicInput({ when: "upcoming", limit: 50 });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.limit).toBe(50);

    const capped = parseExplorerPublicInput({ when: "upcoming", limit: 999 });
    expect(capped.ok).toBe(true);
    if (!capped.ok) return;
    expect(capped.query.limit).toBe(50);
  });

  it("accepte une fenêtre civile from/to avec upcoming", () => {
    const parsed = parseExplorerPublicInput({
      when: "upcoming",
      from: "2026-12-01",
      to: "2027-02-28",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.from).toBe("2026-12-01");
    expect(parsed.query.to).toBe("2027-02-28");
  });

  it("rejette from/to incomplets, inversés ou hors upcoming", () => {
    expect(
      parseExplorerPublicInput({ when: "upcoming", from: "2026-12-01" }).ok,
    ).toBe(false);
    expect(
      parseExplorerPublicInput({
        when: "upcoming",
        from: "2027-02-28",
        to: "2026-12-01",
      }).ok,
    ).toBe(false);
    expect(
      parseExplorerPublicInput({
        when: "weekend",
        from: "2026-12-01",
        to: "2027-02-28",
      }).ok,
    ).toBe(false);
    expect(
      parseExplorerPublicInput({
        when: "upcoming",
        from: "2026-13-01",
        to: "2026-13-31",
      }).ok,
    ).toBe(false);
  });
});
