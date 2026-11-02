import "server-only";

import { resolveResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import {
  markPasswordResetProviderUnavailable,
  passwordResetSendProbe,
} from "@/infrastructure/email/password-reset-send-probe";
import { sendVerificationEmailMessage } from "@/infrastructure/email/send-verification-email";

type VerificationUser = {
  email: string;
};

/**
 * Handler Better Auth `emailVerification.sendVerificationEmail`.
 * Réutilise Resend + la même sonde/cooldown que le reset (même provider).
 * Ne journalise jamais l’URL ni le jeton.
 */
export function createSendVerificationEmail(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return async ({
    user,
    url,
  }: {
    user: VerificationUser;
    url: string;
    token: string;
  }): Promise<void> => {
    const config = resolveResendPasswordResetConfig(env);

    if (!config) {
      if (env.NODE_ENV !== "production") {
        console.info("[detour:auth] verify email (dev stub)", {
          email: user.email,
        });
        return;
      }
      console.error(
        "[detour:auth] email verification requested but Resend is not configured",
      );
      const probe = passwordResetSendProbe.getStore();
      if (probe) probe.failed = true;
      markPasswordResetProviderUnavailable();
      throw new Error("Verification email provider is not configured");
    }

    try {
      await sendVerificationEmailMessage({
        to: user.email,
        verifyUrl: url,
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
