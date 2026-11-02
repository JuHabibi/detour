import { describe, expect, it } from "vitest";
import {
  buildExplorerMetadata,
  isExplorerIndexableSearchParams,
} from "@/features/explorer/explorer-seo";

describe("isExplorerIndexableSearchParams", () => {
  it("autorise l’URL propre sans paramètres", () => {
    expect(isExplorerIndexableSearchParams({})).toBe(true);
  });

  it("refuse tout paramètre non vide (filtres Explorer)", () => {
    expect(isExplorerIndexableSearchParams({ when: "today" })).toBe(false);
    expect(isExplorerIndexableSearchParams({ q: "jazz" })).toBe(false);
    expect(isExplorerIndexableSearchParams({ city: "Orléans" })).toBe(false);
    expect(isExplorerIndexableSearchParams({ category: "Concert" })).toBe(
      false,
    );
    expect(
      isExplorerIndexableSearchParams({ audience: "jeune_public" }),
    ).toBe(false);
    expect(
      isExplorerIndexableSearchParams({
        when: "range",
        from: "2026-04-01",
        to: "2026-04-30",
      }),
    ).toBe(false);
  });

  it("refuse les query parasites (utm, when=weekend redondant)", () => {
    expect(isExplorerIndexableSearchParams({ utm_source: "newsletter" })).toBe(
      false,
    );
    expect(isExplorerIndexableSearchParams({ when: "weekend" })).toBe(false);
  });

  it("ignore les clés vides / undefined", () => {
    expect(
      isExplorerIndexableSearchParams({
        when: undefined,
        q: "",
        city: [],
      }),
    ).toBe(true);
  });
});

describe("buildExplorerMetadata", () => {
  it("indexe l’URL propre avec canonical Explorer", () => {
    expect(buildExplorerMetadata({})).toMatchObject({
      title: "Explorer les sorties",
      alternates: { canonical: "/explorer" },
      robots: { index: true, follow: true },
    });
  });

  it("noindex + follow les URLs filtrées, canonical inchangé", () => {
    expect(buildExplorerMetadata({ q: "jazz", when: "today" })).toMatchObject({
      alternates: { canonical: "/explorer" },
      robots: { index: false, follow: true },
    });
  });
});
