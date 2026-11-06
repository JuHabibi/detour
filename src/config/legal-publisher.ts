/**
 * Éditeur / responsable de traitement — configuration minimale.
 *
 * Hypothèse actuelle : édition à titre non professionnel (LCEN art. 1-1 II).
 * Les mentions publiques n’affichent pas le domicile.
 * La confidentialité publie l’identité du responsable + un contact effectif (RGPD).
 *
 * Identification communiquée à Vercel (compte / facturation) : nom, prénom,
 * adresse postale, e-mail et téléphone — condition LCEN art. 1-1 II.
 */
export type LegalPublisher = {
  /** Identité du responsable du traitement (politique de confidentialité). */
  name: string;
  /** Contact effectif (mentions / demandes RGPD). */
  email: string;
};

export const legalPublisher: LegalPublisher = {
  name: "Julien Habibi",
  email: "detour.orleans@gmail.com",
};

export function isLegalPublisherReady(
  publisher: LegalPublisher | null = legalPublisher,
): boolean {
  if (!publisher) return false;
  return publisher.name.trim().length > 0 && publisher.email.trim().length > 0;
}
