import { describe, expect, it } from "vitest";
import {
  buildExplorerMetadata,
  isExplorerIndexableSearchParams,
} from "@/features/explorer/explorer-seo";

describe("isExplorerIndexableSearchParams", () => {
  it("autorise l’URL propre sans paramètres", () => {
    expect(isExplorerIndexableSearchParams({})).toBe(true);
  });

  it("autorise les seuls paramètres de suivi (contenu inchangé)", () => {
    expect(
      isExplorerIndexableSearchParams({
        utm_source: "newsletter",
        utm_medium: "email",
        gclid: "abc",
      }),
    ).toBe(true);
  });

  it("autorise when=weekend redondant (défaut, contenu inchangé)", () => {
    expect(isExplorerIndexableSearchParams({ when: "weekend" })).toBe(true);
  });

  it("refuse recherche et filtres qui modifient le contenu", () => {
    expect(isExplorerIndexableSearchParams({ when: "today" })).toBe(false);
    expect(isExplorerIndexableSearchParams({ q: "jazz" })).toBe(false);
    expect(isExplorerIndexableSearchParams({ city: "Orléans" })).toBe(false);
    expect(isExplorerIndexableSearchParams({ category: "Musique" })).toBe(
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
  it("indexe l’URL propre avec canonical, OG communs et Twitter Explorer", () => {
    expect(buildExplorerMetadata({})).toEqual({
      title: "Explorer les sorties",
      description:
        "Parcourez concerts, spectacles et sorties autour d’Orléans — filtrez par période, ville, catégorie ou recherche.",
      robots: { index: true, follow: true },
      alternates: { canonical: "/explorer" },
      openGraph: {
        type: "website",
        locale: "fr_FR",
        siteName: "Détour",
        title: "Explorer les sorties",
        description:
          "Parcourez concerts, spectacles et sorties autour d’Orléans — filtrez par période, ville, catégorie ou recherche.",
        url: "/explorer",
      },
      twitter: {
        card: "summary_large_image",
        title: "Explorer les sorties",
        description:
          "Parcourez concerts, spectacles et sorties autour d’Orléans — filtrez par période, ville, catégorie ou recherche.",
      },
    });
  });

  it("indexe le suivi seul avec canonical /explorer", () => {
    const meta = buildExplorerMetadata({ utm_source: "newsletter" });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates).toEqual({ canonical: "/explorer" });
  });

  it("noindex les URLs filtrées sans canonical vers /explorer", () => {
    const meta = buildExplorerMetadata({ q: "jazz", when: "today" });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).not.toHaveProperty("url");
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Explorer les sorties",
    });
    expect(meta.openGraph).toMatchObject({
      type: "website",
      locale: "fr_FR",
      siteName: "Détour",
    });
  });
});
