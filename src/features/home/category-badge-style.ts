import type { CategoryId } from "@/data/types";

type ProductCategory = Exclude<CategoryId, "tout">;

/**
 * Fond pastel du cartouche catégorie.
 * Familles de teintes regroupées pour rester élégant (pas un arc-en-ciel).
 * Couleur basée sur `event.category` produit ; le label affiché peut rester genre/source.
 */
export const categoryBadgeTone: Record<ProductCategory, string> = {
  Musique: "bg-lilac-soft text-ink",
  Spectacle: "bg-blush-soft text-ink",
  Atelier: "bg-mint-soft text-ink",
  Rencontre: "bg-mint-soft text-ink",
  Exposition: "bg-ink-3 text-ink",
  Visite: "bg-sky-soft text-ink",
  "Loisirs culturels": "bg-sky-soft text-ink",
  "Jeune public": "bg-peach-soft text-ink",
  "Fête / salon / marché": "bg-sun-soft text-ink",
  Autre: "bg-ink-3 text-cream-dim",
};

export function resolveCategoryBadgeTone(
  category: CategoryId | null | undefined,
): string {
  if (!category || category === "tout") return categoryBadgeTone.Autre;
  return categoryBadgeTone[category] ?? categoryBadgeTone.Autre;
}
