import type { CategoryId } from "@/data/types";

export const categories: { id: CategoryId; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "Musique", label: "Musique" },
  { id: "Spectacle", label: "Spectacle" },
  { id: "Exposition", label: "Exposition" },
  { id: "Atelier", label: "Atelier" },
  { id: "Jeune public", label: "Jeune public" },
  { id: "Rencontre", label: "Rencontre" },
  { id: "Visite", label: "Visite" },
  { id: "Fête / salon / marché", label: "Fête / salon / marché" },
  { id: "Loisirs culturels", label: "Loisirs culturels" },
  { id: "Autre", label: "Autre" },
];
