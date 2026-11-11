import type {
  UserProfileAvailability,
  UserProfileBudget,
  UserProfileInterest,
} from "@/domain/personalization/user-profile";
import { USER_PROFILE_INTERESTS } from "@/domain/personalization/user-profile";

const INTEREST_LABELS: Record<UserProfileInterest, string> = {
  Musique: "Musique",
  Spectacle: "Spectacle",
  Cinéma: "Cinéma",
  Exposition: "Exposition",
  Atelier: "Atelier",
  "Jeune public": "Jeune public",
  Rencontre: "Rencontre",
  Visite: "Visite",
  "Fête / salon / marché": "Fête / salon",
  "Loisirs culturels": "Loisirs",
};

export const INTEREST_OPTIONS: { id: UserProfileInterest; label: string }[] =
  USER_PROFILE_INTERESTS.map((id) => ({
    id,
    label: INTEREST_LABELS[id],
  }));

export const AVAILABILITY_OPTIONS: {
  id: UserProfileAvailability;
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
  id: UserProfileBudget;
  label: string;
  hint: string;
}[] = [
  {
    id: "free_preferred",
    label: "Gratuit privilégié",
    hint: "Mettre en avant les entrées libres",
  },
  {
    id: "any",
    label: "Tous les budgets",
    hint: "Je regarde d’abord l’intérêt",
  },
];
