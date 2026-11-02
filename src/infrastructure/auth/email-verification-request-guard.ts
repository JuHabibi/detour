import "server-only";

import { resolveResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import {
  isPasswordResetProviderInCooldown,
  passwordResetSendProbe,
  type PasswordResetSendProbe,
} from "@/infrastructure/email/password-reset-send-probe";

export const EMAIL_VERIFICATION_OPS_UNAVAILABLE_MESSAGE =
  "Le service d’envoi d’email est temporairement indisponible. Réessayez plus tard.";

const SIGN_UP_EMAIL_SUFFIXES = ["/sign-up/email", "/sign-up"] as const;
const SEND_VERIFICATION_SUFFIXES = ["/send-verification-email"] as const;

function pathMatchesSuffixes(
  pathname: string,
  suffixes: readonly string[],
): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return suffixes.some(
    (suffix) =>
      normalized === suffix ||
      normalized.endsWith(suffix) ||
      normalized.endsWith(`/api/auth${suffix}`),
  );
}

/** Inscription email — déclenche `sendVerificationEmail` (erreurs avalées par BA). */
export function isEmailSignUpRequestPath(pathname: string): boolean {
  return pathMatchesSuffixes(pathname, SIGN_UP_EMAIL_SUFFIXES);
}

/** Renvoi explicite du lien de vérification. */
export function isSendVerificationEmailRequestPath(pathname: string): boolean {
  return pathMatchesSuffixes(pathname, SEND_VERIFICATION_SUFFIXES);
}

export function emailVerificationOpsUnavailableResponse(): Response {
  return Response.json(
    {
      message: EMAIL_VERIFICATION_OPS_UNAVAILABLE_MESSAGE,
      code: "EMAIL_VERIFICATION_PROVIDER_UNAVAILABLE",
    },
    { status: 503 },
  );
}

/**
 * Garde avant Better Auth (prod) : Resend absent / cooldown → 503.
 * Évite de créer un compte sans pouvoir envoyer le mail de confirmation.
 */
export function shouldBlockEmailVerificationBeforeAuth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return false;
  if (!resolveResendPasswordResetConfig(env)) return true;
  return isPasswordResetProviderInCooldown();
}

export async function runEmailVerificationRequestWithSendProbe(
  run: () => Promise<Response>,
): Promise<Response> {
  const probe: PasswordResetSendProbe = { failed: false };
  const response = await passwordResetSendProbe.run(probe, run);
  if (probe.failed) {
    return emailVerificationOpsUnavailableResponse();
  }
  return response;
}
