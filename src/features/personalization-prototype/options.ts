import type { AvailabilityId, BudgetId, InterestId } from "./types";

export const INTEREST_OPTIONS: { id: InterestId; label: string }[] = [
  { id: "Musique", label: "Musique" },
  { id: "Spectacle", label: "Spectacle" },
  { id: "Cinéma", label: "Cinéma" },
  { id: "Exposition", label: "Exposition" },
  { id: "Atelier", label: "Atelier" },
  { id: "Rencontre", label: "Rencontre" },
  { id: "Visite", label: "Visite" },
  { id: "Jeune public", label: "Jeune public" },
  { id: "Fête / salon / marché", label: "Fête / salon" },
  { id: "Loisirs culturels", label: "Loisirs" },
];

export const AVAILABILITY_OPTIONS: {
  id: AvailabilityId;
  label: string;
  hint: string;
}[] = [
  {
    id: "weekday-evening",
    label: "Soirs de semaine",
    hint: "Après 17 h, lundi–vendredi",
  },
  {
    id: "weekend-day",
    label: "Week-end en journée",
    hint: "Samedi–dimanche avant 17 h",
  },
  {
    id: "weekend-evening",
    label: "Soirs de week-end",
    hint: "Samedi–dimanche après 17 h",
  },
  {
    id: "flexible",
    label: "Je m’adapte",
    hint: "Peu importe le créneau",
  },
];

export const BUDGET_OPTIONS: {
  id: BudgetId;
  label: string;
  hint: string;
}[] = [
  { id: "free", label: "Gratuit", hint: "Entrée libre ou 0 €" },
  { id: "under-15", label: "Jusqu’à 15 €", hint: "Sorties accessibles" },
  { id: "under-30", label: "Jusqu’à 30 €", hint: "Un peu plus d’ampleur" },
  { id: "any", label: "Sans limite", hint: "Je regarde d’abord l’intérêt" },
];
