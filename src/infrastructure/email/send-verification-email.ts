import "server-only";

import type { ResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import { resendFailureCode } from "@/infrastructure/email/send-password-reset-email";

export type SendVerificationEmailInput = {
  to: string;
  /** Lien Better Auth complet (`/api/auth/verify-email?token=...`). */
  verifyUrl: string;
  config: ResendPasswordResetConfig;
  fetchImpl?: typeof fetch;
};

/**
 * Envoi minimal via l’API HTTP Resend.
 * Ne journalise jamais `verifyUrl`, jeton, clé API ni adresse destinataire.
 */
export async function sendVerificationEmailMessage(
  input: SendVerificationEmailInput,
): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.config.from,
      to: [input.to],
      subject: "Confirmez votre email Détour",
      text: [
        "Bonjour,",
        "",
        "Confirmez votre adresse email pour activer votre compte Détour.",
        "Ouvrez le lien ci-dessous (valable une heure) :",
        "",
        input.verifyUrl,
        "",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.",
        "",
        "— L’équipe Détour",
      ].join("\n"),
    }),
  });

  if (response.ok) return;

  await response.text().catch(() => undefined);

  console.error("[detour:auth] Resend email-verification failed", {
    status: response.status,
    code: resendFailureCode(response.status),
  });
  throw new Error("Failed to send verification email");
}
