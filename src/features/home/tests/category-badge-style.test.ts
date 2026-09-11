import { describe, expect, it } from "vitest";
import {
  categoryBadgeTone,
  resolveCategoryBadgeTone,
} from "@/features/home/category-badge-style";
import type { CategoryId } from "@/data/types";

const PRODUCT: Exclude<CategoryId, "tout">[] = [
  "Musique",
  "Spectacle",
  "Exposition",
  "Atelier",
  "Jeune public",
  "Rencontre",
  "Visite",
  "Fête / salon / marché",
  "Loisirs culturels",
  "Autre",
];

describe("categoryBadgeTone", () => {
  it("couvre toutes les catégories produit", () => {
    for (const id of PRODUCT) {
      expect(categoryBadgeTone[id]).toMatch(/^bg-\S+ text-\S+$/);
    }
  });

  it("fallback Autre pour tout / null", () => {
    expect(resolveCategoryBadgeTone("tout")).toBe(categoryBadgeTone.Autre);
    expect(resolveCategoryBadgeTone(null)).toBe(categoryBadgeTone.Autre);
  });

  it("regroupe Atelier et Rencontre sur mint-soft", () => {
    expect(categoryBadgeTone.Atelier).toBe(categoryBadgeTone.Rencontre);
  });

  it("regroupe Visite et Loisirs culturels sur sky-soft", () => {
    expect(categoryBadgeTone.Visite).toBe(
      categoryBadgeTone["Loisirs culturels"],
    );
  });
});
