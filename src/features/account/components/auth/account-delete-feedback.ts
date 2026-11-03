export const DELETE_ACCOUNT_OPS_ERROR =
  "Le service de suppression de compte est temporairement indisponible. Réessayez plus tard.";

export const DELETE_ACCOUNT_INVALID_PASSWORD =
  "Mot de passe incorrect. Aucune suppression n’a été lancée.";

export const DELETE_ACCOUNT_GENERIC_ERROR =
  "Impossible de lancer la suppression. Réessayez plus tard.";

export const DELETE_ACCOUNT_EMAIL_SENT =
  "Un email de confirmation vient d’être envoyé. Ouvrez le lien (valable 24 h) en restant connecté pour finaliser la suppression.";

export const DELETE_ACCOUNT_INVALID_LINK =
  "Ce lien de suppression est invalide ou a expiré. Aucun compte n’a été supprimé.";

/** Accès direct à `/account/deleted` sans flash de confirmation. */
export const DELETE_ACCOUNT_DIRECT_ACCESS =
  "Cette page confirme uniquement une suppression déjà validée par email. Si vous n’avez rien demandé, votre compte n’a pas été modifié.";

export function mapDeleteAccountClientError(code: string | undefined): string {
  if (code === "INVALID_PASSWORD") return DELETE_ACCOUNT_INVALID_PASSWORD;
  if (code === "DELETE_ACCOUNT_PROVIDER_UNAVAILABLE") {
    return DELETE_ACCOUNT_OPS_ERROR;
  }
  return DELETE_ACCOUNT_GENERIC_ERROR;
}
