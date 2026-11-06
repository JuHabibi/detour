/**
 * Identité de l’éditeur du site Détour (mentions légales / contact privacy).
 *
 * Ne jamais inventer de valeurs. Tant que `legalPublisher` est `null`,
 * les mentions légales n’affichent pas de rubrique éditeur et la PR
 * de publication doit rester en draft.
 *
 * À renseigner uniquement avec des informations confirmées par l’éditeur :
 * - name : nom ou raison sociale
 * - legalStatus : forme juridique (ex. micro-entreprise, SAS…) si applicable
 * - registrationNumber : SIRET / RCS / équivalent si applicable
 * - addressLines : adresse postale de publication si requise
 * - email : contact légal / exercice des droits
 * - publicationDirector : directeur de la publication si applicable
 */
export type LegalPublisher = {
  name: string;
  legalStatus: string | null;
  registrationNumber: string | null;
  addressLines: readonly string[] | null;
  email: string;
  publicationDirector: string | null;
};

/** `null` = identité éditeur non confirmée — bloquant pour la publication. */
export const legalPublisher: LegalPublisher | null = null;

export function isLegalPublisherReady(
  publisher: LegalPublisher | null = legalPublisher,
): boolean {
  if (!publisher) return false;
  return publisher.name.trim().length > 0 && publisher.email.trim().length > 0;
}
