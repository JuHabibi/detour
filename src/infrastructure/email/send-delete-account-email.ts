import "server-only";

import type { ResendPasswordResetConfig } from "@/infrastructure/email/password-reset-config";
import { resendFailureCode } from "@/infrastructure/email/send-password-reset-email";

export type SendDeleteAccountEmailInput = {
  to: string;
  /** Lien Better Auth `/api/auth/delete-user/callback?token=...`. */
  deleteUrl: string;
  config: ResendPasswordResetConfig;
  fetchImpl?: typeof fetch;
};

/**
 * Email de confirmation de suppression de compte.
 * Ne journalise jamais URL, jeton, clé ni destinataire.
 */
export async function sendDeleteAccountEmailMessage(
  input: SendDeleteAccountEmailInput,
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
      subject: "Confirmez la suppression de votre compte Détour",
      text: [
        "Bonjour,",
        "",
        "Vous avez demandé la suppression définitive de votre compte Détour.",
        "Cette action effacera vos favoris, carnets et données de connexion.",
        "Les événements culturels publics ne sont pas concernés.",
        "",
        "Pour confirmer, ouvrez le lien ci-dessous (valable 24 heures) en étant connecté à Détour :",
        "",
        input.deleteUrl,
        "",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre compte restera intact.",
        "",
        "— L’équipe Détour",
      ].join("\n"),
    }),
  });

  if (response.ok) return;

  await response.text().catch(() => undefined);

  console.error("[detour:auth] Resend delete-account failed", {
    status: response.status,
    code: resendFailureCode(response.status),
  });
  throw new Error("Failed to send delete-account email");
}
