import type { WhenFilter } from "@/domain/time/when-filter";

/**
 * Sous-titre de résultats Explorer — complète le h1 « Explorer les sorties »
 * et le select Période sans le recopier mot pour mot.
 */
export const EXPLORER_PERIOD_RESULT_TITLES: Record<WhenFilter, string> = {
  today: "Sorties du jour autour d’Orléans",
  tomorrow: "Sorties de demain autour d’Orléans",
  weekend: "Sorties de ce week-end autour d’Orléans",
  "next-week": "Sorties de la semaine prochaine autour d’Orléans",
  "this-month": "Sorties de ce mois-ci autour d’Orléans",
  "next-month": "Sorties du mois prochain autour d’Orléans",
  upcoming: "Toutes les sorties à venir autour d’Orléans",
};

/** Empty state — oriente vers un élargissement des filtres, sans changer les règles. */
export const EXPLORER_PERIOD_EMPTY_MESSAGES: Record<WhenFilter, string> = {
  today:
    "Aucune sortie aujourd’hui pour ces filtres. Essayez une autre période, ville ou catégorie.",
  tomorrow:
    "Aucune sortie demain pour ces filtres. Essayez une autre période, ville ou catégorie.",
  weekend:
    "Aucune sortie ce week-end pour ces filtres. Essayez « À venir », une autre ville ou une autre catégorie.",
  "next-week":
    "Aucune sortie la semaine prochaine pour ces filtres. Essayez une autre période, ville ou catégorie.",
  "this-month":
    "Aucune sortie ce mois-ci pour ces filtres. Essayez une autre période, ville ou catégorie.",
  "next-month":
    "Aucune sortie le mois prochain pour ces filtres. Essayez une autre période, ville ou catégorie.",
  upcoming:
    "Aucune sortie à venir pour ces filtres. Essayez une autre ville ou une autre catégorie.",
};

export function explorerPeriodResultTitle(when: WhenFilter): string {
  return EXPLORER_PERIOD_RESULT_TITLES[when];
}

export function explorerPeriodEmptyMessage(when: WhenFilter): string {
  return EXPLORER_PERIOD_EMPTY_MESSAGES[when];
}
