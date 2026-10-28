import "server-only";

import type { ResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";

export type SendPasswordResetEmailInput = {
  to: string;
  /** Lien Better Auth complet (`/api/auth/reset-password/:token?...`). */
  resetUrl: string;
  config: ResendPasswordResetConfig;
  fetchImpl?: typeof fetch;
};

/**
 * Codes ops stables — jamais le body Resend (peut contenir des détails
 * non contrôlés), ni resetUrl / jeton / clé / destinataire.
 */
export function resendFailureCode(status: number): string {
  if (status === 401 || status === 403) return "RESEND_UNAUTHORIZED";
  if (status === 422) return "RESEND_VALIDATION";
  if (status === 429) return "RESEND_RATE_LIMITED";
  if (status >= 500) return "RESEND_UPSTREAM";
  return "RESEND_ERROR";
}

/**
 * Envoi minimal via l’API HTTP Resend (forfait gratuit).
 * Ne journalise jamais `resetUrl`, jeton, clé API ni adresse destinataire.
 */
export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput,
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
      subject: "Réinitialisation de votre mot de passe Détour",
      text: [
        "Bonjour,",
        "",
        "Vous avez demandé à réinitialiser le mot de passe de votre compte Détour.",
        "Ouvrez le lien ci-dessous (valable une heure) pour choisir un nouveau mot de passe :",
        "",
        input.resetUrl,
        "",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.",
        "",
        "— L’équipe Détour",
      ].join("\n"),
    }),
  });

  if (response.ok) return;

  // Consommer le body sans le journaliser (évite fuite de détail provider).
  await response.text().catch(() => undefined);

  console.error("[detour:auth] Resend password-reset failed", {
    status: response.status,
    code: resendFailureCode(response.status),
  });
  throw new Error("Failed to send password reset email");
}
