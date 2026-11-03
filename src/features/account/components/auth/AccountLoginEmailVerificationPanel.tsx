"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  EMAIL_VERIFICATION_OPS_ERROR,
  EMAIL_VERIFICATION_REQUIRED_LEAD,
  EMAIL_VERIFICATION_REQUIRED_TITLE,
  EMAIL_VERIFICATION_SENT_LEAD,
} from "@/features/account/components/auth/account-email-verification-feedback";
import {
  accountVerifyEmailCallbackPath,
  accountVerifyEmailPageHref,
} from "@/lib/account-verify-email-path";
import {
  extractPendingFavoriteIdFromPath,
  savePendingFavoriteIntent,
} from "@/lib/pending-favorite";

type AccountLoginEmailVerificationPanelProps = {
  email: string;
  nextPath: string;
  onChangeEmail: () => void;
};

/**
 * État informatif post-login `EMAIL_NOT_VERIFIED` — pas une alerte erreur.
 * Envoi via l’API native ; succès seulement après réponse OK.
 */
export function AccountLoginEmailVerificationPanel({
  email,
  nextPath,
  onChangeEmail,
}: AccountLoginEmailVerificationPanelProps) {
  const [pending, setPending] = useState(false);
  const [sentOnce, setSentOnce] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState(false);
  const pendingFavoriteId = extractPendingFavoriteIdFromPath(nextPath);
  const verifyPageHref = accountVerifyEmailPageHref({
    email,
    next: nextPath === "/account" ? null : nextPath,
  });

  async function handleSend() {
    setSendError(null);
    setSendOk(false);

    if (pendingFavoriteId) {
      savePendingFavoriteIntent(pendingFavoriteId, nextPath);
    }

    setPending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: accountVerifyEmailCallbackPath(nextPath),
      });
      if (result.error) {
        setSendError(EMAIL_VERIFICATION_OPS_ERROR);
        return;
      }
      setSentOnce(true);
      setSendOk(true);
    } catch {
      setSendError(EMAIL_VERIFICATION_OPS_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="mt-10 space-y-6 md:mt-12"
      role="status"
      aria-live="polite"
    >
      <div className="border-t border-line pt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
          Confirmation
        </p>
        <h2 className="mt-3 font-display text-[1.65rem] leading-[1.08] tracking-tight text-ink md:text-[1.85rem]">
          {EMAIL_VERIFICATION_REQUIRED_TITLE}
        </h2>
        <p className="mt-4 text-sm leading-6 text-cream-dim">
          {EMAIL_VERIFICATION_REQUIRED_LEAD}
        </p>
        <p className="mt-4 break-all text-sm font-medium text-ink">{email}</p>
      </div>

      {sendOk ? (
        <p className="text-sm leading-6 text-cream-dim">{EMAIL_VERIFICATION_SENT_LEAD}</p>
      ) : null}

      {sendError ? (
        <p className="text-sm text-coral" role="alert">
          {sendError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleSend()}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? "Envoi…"
            : sentOnce
              ? "Renvoyer"
              : "Envoyer un lien de confirmation"}
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="inline-flex min-h-11 items-center justify-center px-1 text-sm font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 transition-colors hover:decoration-coral sm:px-2"
        >
          Modifier l’adresse
        </button>
      </div>

      <p className="text-sm leading-6 text-cream-dim">
        <Link
          href={verifyPageHref}
          className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral"
        >
          Ouvrir la page de confirmation
        </Link>
        {" "}
        pour saisir une autre adresse.
      </p>
    </div>
  );
}
