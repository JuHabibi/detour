/** Codes Better Auth traités comme lien définitivement inutilisable. */
const INVALID_LINK_CODES = new Set([
  "INVALID_TOKEN",
  "TOKEN_EXPIRED",
  "USER_NOT_FOUND",
]);

export type ResetPasswordFeedbackKind = "invalid_link" | "retryable";

export type ResetPasswordFeedback = {
  kind: ResetPasswordFeedbackKind;
  message: string;
};

export const RESET_PASSWORD_INVALID_LINK_MESSAGE =
  "Ce lien de réinitialisation est invalide, expiré ou déjà utilisé.";

export const RESET_PASSWORD_RETRYABLE_MESSAGE =
  "Impossible de réinitialiser le mot de passe pour le moment. Réessayez.";

export const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Votre mot de passe a bien été modifié.";

/**
 * Mappe une erreur Better Auth / client vers un feedback UX.
 * Ne propage jamais le message technique ni le token.
 */
export function mapResetPasswordClientError(error: {
  code?: string | null;
  message?: string | null;
} | null): ResetPasswordFeedback {
  const code = error?.code?.trim().toUpperCase() || "";
  if (INVALID_LINK_CODES.has(code)) {
    return {
      kind: "invalid_link",
      message: RESET_PASSWORD_INVALID_LINK_MESSAGE,
    };
  }
  return {
    kind: "retryable",
    message: RESET_PASSWORD_RETRYABLE_MESSAGE,
  };
}
