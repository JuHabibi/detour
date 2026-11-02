"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { AccountAuthLayout } from "@/features/account/components/auth/AccountAuthLayout";
import {
  EMAIL_VERIFICATION_OPS_ERROR,
  EMAIL_VERIFICATION_SENT_LEAD,
  EMAIL_VERIFIED_LOGIN_MESSAGE,
} from "@/features/account/components/auth/account-email-verification-feedback";
import { accountVerifyEmailCallbackPath } from "@/lib/account-verify-email-path";
import { accountLoginHref } from "@/lib/safe-account-next-path";
import {
  extractPendingFavoriteIdFromPath,
  savePendingFavoriteIntent,
} from "@/lib/pending-favorite";

const fieldClassName =
  "mt-2 h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint";

type AccountVerifyEmailProps = {
  nextPath?: string;
  initialEmail?: string;
  initialError?: string | null;
  /** Arrivée après clic sur le lien BA (sans `error`). */
  confirmed?: boolean;
};

export function AccountVerifyEmail({
  nextPath = "/account",
  initialEmail = "",
  initialError = null,
  confirmed = false,
}: AccountVerifyEmailProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(initialError);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingFavoriteId = extractPendingFavoriteIdFromPath(nextPath);
  const loginHref = accountLoginHref(
    nextPath === "/account" ? null : nextPath,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (pendingFavoriteId) {
      savePendingFavoriteIntent(pendingFavoriteId, nextPath);
    }

    setPending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: accountVerifyEmailCallbackPath(nextPath),
      });
      if (result.error) {
        setError(EMAIL_VERIFICATION_OPS_ERROR);
        return;
      }
      setDone(true);
    } catch {
      setError(EMAIL_VERIFICATION_OPS_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (confirmed && !initialError) {
    return (
      <AccountAuthLayout variant="login">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
          Confirmation email
        </p>
        <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
          Adresse confirmée.
        </h1>
        <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
          {EMAIL_VERIFIED_LOGIN_MESSAGE}
        </p>
        <p className="mt-10 md:mt-12">
          <Link
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
          >
            Se connecter
          </Link>
        </p>
      </AccountAuthLayout>
    );
  }

  return (
    <AccountAuthLayout variant="login">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Confirmation email
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        Vérifiez votre boîte.
      </h1>
      <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
        Un lien de confirmation est nécessaire avant la première connexion.
        Après confirmation, reconnectez-vous pour accéder à vos favoris et
        carnets.
      </p>

      {done ? (
        <p className="mt-10 text-sm leading-6 text-cream-dim md:mt-12">
          {EMAIL_VERIFICATION_SENT_LEAD}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 space-y-5 md:mt-12">
          <label className="block">
            <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
              Email
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
              className={fieldClassName}
            />
          </label>

          {error ? (
            <p className="text-sm text-coral" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 w-full items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Envoi…" : "Renvoyer le lien"}
          </button>
        </form>
      )}

      <p className="mt-8 text-sm text-cream-dim">
        <Link
          href={loginHref}
          className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral"
        >
          Retour à la connexion
        </Link>
      </p>
    </AccountAuthLayout>
  );
}
