/** Codes Better Auth sur le callback verify-email / login. */
const INVALID_LINK_CODES = new Set([
  "INVALID_TOKEN",
  "TOKEN_EXPIRED",
  "USER_NOT_FOUND",
]);

export const EMAIL_NOT_VERIFIED_CODE = "EMAIL_NOT_VERIFIED";

/** Titre court — état informatif login (pas une erreur). */
export const EMAIL_VERIFICATION_REQUIRED_TITLE = "Confirmez votre email";

export const EMAIL_VERIFICATION_REQUIRED_LEAD =
  "Ce compte existe, mais l’adresse n’a pas encore été confirmée. Un lien de confirmation est nécessaire avant la connexion.";

export const EMAIL_VERIFICATION_SENT_LEAD =
  "Si un compte correspond à cet email, un lien de confirmation a été envoyé. Pensez à vérifier vos indésirables.";

export const EMAIL_VERIFICATION_OPS_ERROR =
  "Le service d’envoi d’email est temporairement indisponible. Réessayez plus tard.";

export const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  EMAIL_VERIFICATION_REQUIRED_LEAD;

export const EMAIL_VERIFICATION_INVALID_LINK_MESSAGE =
  "Ce lien de confirmation est invalide ou a expiré. Demandez un nouveau lien.";

export const EMAIL_VERIFIED_LOGIN_MESSAGE =
  "Email confirmé. Connectez-vous pour continuer.";

export function isEmailNotVerifiedError(error: {
  code?: string | null;
  message?: string | null;
} | null): boolean {
  const code = error?.code?.trim().toUpperCase() || "";
  if (code === EMAIL_NOT_VERIFIED_CODE) return true;
  const message = error?.message?.trim().toLowerCase() || "";
  return message.includes("email not verified");
}

export function mapVerifyEmailCallbackError(
  raw: string | string[] | undefined | null,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!code) return null;
  if (INVALID_LINK_CODES.has(code)) {
    return EMAIL_VERIFICATION_INVALID_LINK_MESSAGE;
  }
  return EMAIL_VERIFICATION_INVALID_LINK_MESSAGE;
}
