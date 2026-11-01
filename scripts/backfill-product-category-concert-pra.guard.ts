/**
 * Garde-fou backfill PR-A : une seule transition autorisée.
 * Indépendant du classifieur — le script ne doit jamais écrire autre chose.
 */
export const PRA_CONCERT_BACKFILL_FROM = "Spectacle" as const;
export const PRA_CONCERT_BACKFILL_TO = "Musique" as const;

export function isPraConcertBackfillChange(
  before: string | null | undefined,
  after: string,
): boolean {
  return before === PRA_CONCERT_BACKFILL_FROM && after === PRA_CONCERT_BACKFILL_TO;
}
