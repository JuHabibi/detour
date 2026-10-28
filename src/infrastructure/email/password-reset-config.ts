import "server-only";

export type ResendPasswordResetConfig = {
  apiKey: string;
  from: string;
};

function isTruthyFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/** Resend prêt : clé + expéditeur (domaine vérifié côté Resend). */
export function resolveResendPasswordResetConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ResendPasswordResetConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/**
 * Envoi possible (pages forgot/reset accessibles pour un test contrôlé via URL).
 * Hors prod : toujours true (stub logs sans jeton).
 * Prod : uniquement si `RESEND_API_KEY` + `RESEND_FROM_EMAIL` sont définis.
 */
export function isPasswordResetDeliveryReady(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return true;
  return resolveResendPasswordResetConfig(env) !== null;
}

/**
 * Lien public « Mot de passe oublié » sur l’écran de connexion.
 * Prod : `DETOUR_PASSWORD_RESET_ENABLED=true` **et** delivery Resend prêt.
 * À activer seulement après DNS vérifié + test réel via `/account/forgot-password`.
 * Hors prod : true (même surface que le stub).
 */
export function isPasswordResetPublicLinkEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (!isTruthyFlag(env.DETOUR_PASSWORD_RESET_ENABLED)) return false;
  return resolveResendPasswordResetConfig(env) !== null;
}
