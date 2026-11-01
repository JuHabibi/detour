/**
 * Garde-fou backfill PR-B Cinéma : transitions autorisées uniquement.
 * Indépendant du classifieur — le script ne doit jamais écrire autre chose.
 */
export const PRA_CINEMA_BACKFILL_TO = "Cinéma" as const;

/** Sources stockées aujourd’hui pour les projections mal classées. */
export const PRA_CINEMA_BACKFILL_FROM = ["Spectacle", "Autre"] as const;

export type PraCinemaBackfillFrom =
  (typeof PRA_CINEMA_BACKFILL_FROM)[number];

export function isPraCinemaBackfillChange(
  before: string | null | undefined,
  after: string,
): before is PraCinemaBackfillFrom {
  if (after !== PRA_CINEMA_BACKFILL_TO) return false;
  return (
    before === "Spectacle" || before === "Autre"
  );
}
