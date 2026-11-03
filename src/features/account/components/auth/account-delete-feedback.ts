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

export function mapDeleteAccountClientError(code: string | undefined): string {
  if (code === "INVALID_PASSWORD") return DELETE_ACCOUNT_INVALID_PASSWORD;
  if (code === "DELETE_ACCOUNT_PROVIDER_UNAVAILABLE") {
    return DELETE_ACCOUNT_OPS_ERROR;
  }
  return DELETE_ACCOUNT_GENERIC_ERROR;
}
