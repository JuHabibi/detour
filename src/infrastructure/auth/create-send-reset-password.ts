import "server-only";

import { resolveResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import {
  markPasswordResetProviderUnavailable,
  passwordResetSendProbe,
} from "@/infrastructure/email/password-reset-send-probe";
import { sendPasswordResetEmail } from "@/infrastructure/email/send-password-reset-email";

type ResetPasswordUser = {
  email: string;
};

/**
 * Handler Better Auth `emailAndPassword.sendResetPassword`.
 * Ne journalise jamais l’URL ni le jeton.
 * En prod sans Resend : throw (pas de faux succès) — le wrapper route
 * doit court-circuiter avant BA pour éviter l’énumération.
 */
export function createSendResetPassword(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return async ({
    user,
    url,
  }: {
    user: ResetPasswordUser;
    url: string;
    token: string;
  }): Promise<void> => {
    const config = resolveResendPasswordResetConfig(env);

    if (!config) {
      if (env.NODE_ENV !== "production") {
        console.info("[detour:auth] reset password (dev stub)", {
          email: user.email,
        });
        return;
      }
      console.error(
        "[detour:auth] password reset requested but Resend is not configured",
      );
      const probe = passwordResetSendProbe.getStore();
      if (probe) probe.failed = true;
      markPasswordResetProviderUnavailable();
      throw new Error("Password reset email provider is not configured");
    }

    try {
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        config,
        fetchImpl,
      });
    } catch (error) {
      const probe = passwordResetSendProbe.getStore();
      if (probe) probe.failed = true;
      markPasswordResetProviderUnavailable();
      throw error;
    }
  };
}
