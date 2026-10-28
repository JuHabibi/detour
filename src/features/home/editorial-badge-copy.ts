import type { EditorialBadge } from "@/domain/editorial/resolve-editorial-badge";

/**
 * Variante « trop tard » — proche du hero ; non branchée en live
 * pour éviter de répéter la promesse H1.
 */
export const DETOUR_SECTION_SUBTITLE =
  "Des événements qu’il vaut mieux découvrir aujourd’hui que trop tard.";

/**
 * Sous-titre section Radar (DetourSection) — explique le *pourquoi*
 * de la sélection sans reprendre le hero (« mérite votre attention »).
 */
export const DETOUR_SECTION_EDITORIAL_LINE =
  "Des événements à ne pas manquer, parfois rares, discrets ou à prévoir bien à l’avance.";

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
