import "server-only";

import { resolveResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import {
  markPasswordResetProviderUnavailable,
  passwordResetSendProbe,
} from "@/infrastructure/email/password-reset-send-probe";
import { sendDeleteAccountEmailMessage } from "@/infrastructure/email/send-delete-account-email";

type DeleteAccountUser = {
  email: string;
};

/**
 * Handler Better Auth `user.deleteUser.sendDeleteAccountVerification`.
 * Ne journalise jamais l’URL ni le jeton.
 */
export function createSendDeleteAccountVerification(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return async ({
    user,
    url,
  }: {
    user: DeleteAccountUser;
    url: string;
    token: string;
  }): Promise<void> => {
    const config = resolveResendPasswordResetConfig(env);

    if (!config) {
      if (env.NODE_ENV !== "production") {
        // Stub local : pas d’email, pas de log de destinataire / URL / jeton.
        console.info("[detour:auth] delete-account verification (dev stub)");
        return;
      }
      console.error(
        "[detour:auth] delete-account requested but Resend is not configured",
      );
      const probe = passwordResetSendProbe.getStore();
      if (probe) probe.failed = true;
      markPasswordResetProviderUnavailable();
      throw new Error("Delete-account email provider is not configured");
    }

    try {
      await sendDeleteAccountEmailMessage({
        to: user.email,
        deleteUrl: url,
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
