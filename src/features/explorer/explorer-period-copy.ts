import type { WhenFilter } from "@/domain/time/when-filter";

/**
 * Sous-titre de résultats Explorer — complète le h1 « Explorer les sorties »
 * sans recopier mot pour mot le libellé du contrôle période.
 */
export const EXPLORER_PERIOD_RESULT_TITLES: Record<
  Exclude<WhenFilter, "range">,
  string
> = {
  today: "Sorties du jour autour d’Orléans",
  tomorrow: "Sorties de demain autour d’Orléans",
  weekend: "Sorties de ce week-end autour d’Orléans",
  "next-week": "Sorties de la semaine prochaine autour d’Orléans",
  "this-month": "Sorties de ce mois-ci autour d’Orléans",
  "next-month": "Sorties du mois prochain autour d’Orléans",
  upcoming: "Toutes les sorties à venir autour d’Orléans",
};

/** Empty state — oriente vers un élargissement des filtres, sans changer les règles. */
export const EXPLORER_PERIOD_EMPTY_MESSAGES: Record<
  Exclude<WhenFilter, "range">,
  string
> = {
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

const PARIS_MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

function formatParisDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const month = PARIS_MONTHS_SHORT[(m ?? 1) - 1] ?? "";
  return `${d} ${month}${y ? ` ${y}` : ""}`.trim();
}

export function formatExplorerRangeLabel(from: string, to: string): string {
  if (from === to) return formatParisDayLabel(from);
  const fromParts = from.split("-").map(Number);
  const toParts = to.split("-").map(Number);
  const sameMonth =
    fromParts[0] === toParts[0] && fromParts[1] === toParts[1];
  if (sameMonth) {
    return `${fromParts[2]}–${toParts[2]} ${PARIS_MONTHS_SHORT[(fromParts[1] ?? 1) - 1]}`;
  }
  return `${formatParisDayLabel(from)} – ${formatParisDayLabel(to)}`;
}

/** Libellé compact du déclencheur « Quand ? » (valeur sélectionnée). */
export const EXPLORER_PERIOD_TRIGGER_LABELS: Record<
  Exclude<WhenFilter, "range">,
  string
> = {
  today: "Aujourd’hui",
  tomorrow: "Demain",
  weekend: "Ce week-end",
  "next-week": "Semaine prochaine",
  "this-month": "Ce mois-ci",
  "next-month": "Mois prochain",
  upcoming: "À venir",
};

export function explorerPeriodTriggerLabel(
  when: WhenFilter,
  from: string | null,
  to: string | null,
): string {
  if (when === "range" && from && to) {
    return formatExplorerRangeLabel(from, to);
  }
  if (when === "range") return "Dates…";
  return EXPLORER_PERIOD_TRIGGER_LABELS[when];
}

export function explorerPeriodResultTitle(
  when: WhenFilter,
  range?: { from: string; to: string } | null,
): string {
  if (when === "range" && range?.from && range?.to) {
    return `Sorties du ${formatExplorerRangeLabel(range.from, range.to)} autour d’Orléans`;
  }
  if (when === "range") {
    return "Sorties sur la période choisie autour d’Orléans";
  }
  return EXPLORER_PERIOD_RESULT_TITLES[when];
}

export function explorerPeriodEmptyMessage(
  when: WhenFilter,
  range?: { from: string; to: string } | null,
): string {
  if (when === "range" && range?.from && range?.to) {
    return `Aucune sortie du ${formatExplorerRangeLabel(range.from, range.to)} pour ces filtres. Essayez une autre période, ville ou catégorie.`;
  }
  if (when === "range") {
    return "Aucune sortie pour cette période. Essayez d’autres dates, une autre ville ou une autre catégorie.";
  }
  return EXPLORER_PERIOD_EMPTY_MESSAGES[when];
}
