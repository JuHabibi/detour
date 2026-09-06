import type { EditorialBadge } from "@/domain/editorial/resolve-editorial-badge";

/** Sous-titre section « Faites un détour » (inchangé). */
export const DETOUR_SECTION_SUBTITLE =
  "Des événements qu’on aurait facilement pu rater.";

/** Micro-ligne éditoriale — radar culturel, sans jargon technique. */
export const DETOUR_SECTION_EDITORIAL_LINE =
  "Une sélection repérée pour sa rareté locale, son besoin d’anticipation ou sa faible visibilité.";

/**
 * Micro-explications UI des pastilles — présentation uniquement.
 * Pas de données factuelles inventées, pas d’urgence artificielle.
 */
export const EDITORIAL_BADGE_EXPLANATIONS: Record<EditorialBadge, string> = {
  "À réserver":
    "Cet événement demande probablement de s’y prendre à l’avance.",
  "À anticiper": "À repérer maintenant pour pouvoir s’organiser.",
  "Passage rare": "Un passage inhabituel dans le secteur.",
  "Pépite locale":
    "Un événement intéressant qui risque de passer sous le radar.",
};

export function getEditorialBadgeExplanation(
  badge: EditorialBadge,
): string {
  return EDITORIAL_BADGE_EXPLANATIONS[badge];
}
