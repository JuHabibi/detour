import type { CategoryId } from "@/data/types";

/**
 * Catalogue complet des types produit — y compris « Jeune public » historique
 * (product_category en base, parseur URL, Frise, badges).
 */
export const categories: { id: CategoryId; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "Musique", label: "Musique" },
  { id: "Spectacle", label: "Spectacle" },
  { id: "Cinéma", label: "Cinéma" },
  { id: "Exposition", label: "Exposition" },
  { id: "Atelier", label: "Atelier" },
  { id: "Jeune public", label: "Jeune public" },
  { id: "Rencontre", label: "Rencontre" },
  { id: "Visite", label: "Visite" },
  { id: "Fête / salon / marché", label: "Fête / salon / marché" },
  { id: "Loisirs culturels", label: "Loisirs culturels" },
  { id: "Autre", label: "Autre" },
];

/**
 * Types proposés dans Explorer « Quoi ? ».
 * « Jeune public » est retiré du menu : la jeunesse passe par la facette audience.
 * Les URLs `category=Jeune%20public` restent parsées et filtrées comme avant.
 */
export const explorerTypeCategories = categories.filter(
  (item) => item.id !== "Jeune public",
);
