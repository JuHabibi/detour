import "server-only";

import { resolveResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import {
  isPasswordResetProviderInCooldown,
  passwordResetSendProbe,
  type PasswordResetSendProbe,
} from "@/infrastructure/email/password-reset-send-probe";

export const PASSWORD_RESET_OPS_UNAVAILABLE_MESSAGE =
  "Le service de réinitialisation est temporairement indisponible. Réessayez plus tard.";

const REQUEST_PASSWORD_RESET_PATHS = [
  "/request-password-reset",
  "/forget-password",
  "/forgot-password",
] as const;

export function isPasswordResetRequestPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return REQUEST_PASSWORD_RESET_PATHS.some(
    (suffix) =>
      normalized === suffix ||
      normalized.endsWith(suffix) ||
      normalized.endsWith(`/api/auth${suffix}`),
  );
}

export function passwordResetOpsUnavailableResponse(): Response {
  return Response.json(
    {
      message: PASSWORD_RESET_OPS_UNAVAILABLE_MESSAGE,
      code: "PASSWORD_RESET_PROVIDER_UNAVAILABLE",
    },
    { status: 503 },
  );
}

/**
 * Garde avant Better Auth : Resend absent / cooldown → 503 uniforme
 * (pas de lookup utilisateur → pas d’énumération).
 */
export function shouldBlockPasswordResetBeforeAuth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return false;
  if (!resolveResendPasswordResetConfig(env)) return true;
  return isPasswordResetProviderInCooldown();
}

/**
 * Better Auth avale les erreurs d’envoi dans `runInBackgroundOrAwait`.
 * On exécute le handler dans une sonde ALS ; si l’envoi a échoué → 503.
 */
export async function runPasswordResetRequestWithSendProbe(
  run: () => Promise<Response>,
): Promise<Response> {
  const probe: PasswordResetSendProbe = { failed: false };
  const response = await passwordResetSendProbe.run(probe, run);
  if (probe.failed) {
    return passwordResetOpsUnavailableResponse();
  }
  return response;
}
