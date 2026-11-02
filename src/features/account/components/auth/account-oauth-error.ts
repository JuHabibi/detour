/**
 * Messages UI pour les erreurs OAuth renvoyées en `?error=` par Better Auth.
 * Codes URL-safe (ex. `account_not_linked`), jamais de secrets.
 */

const ACCOUNT_EXISTS_MESSAGE =
  "Un compte existe déjà avec cet email. Utilisez « Se connecter » avec votre mot de passe.";

const CANCELLED_MESSAGE = "Connexion Google annulée. Vous pouvez réessayer.";

const GENERIC_MESSAGE =
  "Impossible de continuer avec Google. Réessayez ou utilisez votre email.";

export function mapAccountOAuthError(
  raw: string | string[] | undefined | null,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  if (!code) return null;

  switch (code) {
    case "account_not_linked":
    case "unable_to_link_account":
    case "email_does_not_match":
    case "account_already_linked_to_different_user":
      return ACCOUNT_EXISTS_MESSAGE;
    case "access_denied":
    case "user_cancelled":
    case "consent_required":
      return CANCELLED_MESSAGE;
    default:
      return GENERIC_MESSAGE;
  }
}
