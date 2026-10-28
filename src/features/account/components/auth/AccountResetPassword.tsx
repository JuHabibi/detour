"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { AccountAuthLayout } from "@/features/account/components/auth/AccountAuthLayout";
import {
  mapResetPasswordClientError,
  RESET_PASSWORD_INVALID_LINK_MESSAGE,
  RESET_PASSWORD_RETRYABLE_MESSAGE,
  RESET_PASSWORD_SUCCESS_MESSAGE,
} from "@/features/account/components/auth/account-reset-password-feedback";

const fieldClassName =
  "mt-2 h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint";

export function AccountResetPassword() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const linkInvalidFromQuery =
    Boolean(searchParams.get("error")) || token.length === 0;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(
    linkInvalidFromQuery ? RESET_PASSWORD_INVALID_LINK_MESSAGE : null,
  );
  const [linkDead, setLinkDead] = useState(linkInvalidFromQuery);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const submitLockRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || pending || linkDead || done) return;

    setError(null);

    if (!token) {
      setLinkDead(true);
      setError(RESET_PASSWORD_INVALID_LINK_MESSAGE);
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    submitLockRef.current = true;
    setPending(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        const feedback = mapResetPasswordClientError(result.error);
        setError(feedback.message);
        if (feedback.kind === "invalid_link") {
          setLinkDead(true);
        }
        return;
      }
      setPassword("");
      setConfirm("");
      setError(null);
      setDone(true);
    } catch {
      setError(RESET_PASSWORD_RETRYABLE_MESSAGE);
    } finally {
      submitLockRef.current = false;
      setPending(false);
    }
  }

  return (
    <AccountAuthLayout variant="login">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Nouveau mot de passe
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        {done ? "Mot de passe mis à jour." : "Choisissez un mot de passe."}
      </h1>
      <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
        {done
          ? RESET_PASSWORD_SUCCESS_MESSAGE
          : "Saisissez un nouveau mot de passe pour votre compte Détour."}
      </p>

      {done ? (
        <p className="mt-10 md:mt-12">
          <Link
            href="/account/login"
            className="inline-flex min-h-11 w-full items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam sm:w-auto"
          >
            Se connecter
          </Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 space-y-5 md:mt-12">
          <label className="block">
            <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
              Nouveau mot de passe
            </span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={linkDead || pending}
              className={fieldClassName}
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
              Confirmer
            </span>
            <input
              type="password"
              name="passwordConfirm"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              disabled={linkDead || pending}
              className={fieldClassName}
            />
          </label>

          {error ? (
            <p className="text-sm text-coral" role="alert">
              {error}
            </p>
          ) : null}

          {linkDead ? (
            <Link
              href="/account/forgot-password"
              className="inline-flex min-h-11 w-full items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam sm:w-auto"
            >
              Demander un nouveau lien
            </Link>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 w-full items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60 sm:w-auto"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          )}
        </form>
      )}

      {!done ? (
        <p className="mt-8 text-sm text-cream-dim">
          <Link
            href="/account/login"
            className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral"
          >
            Retour à la connexion
          </Link>
        </p>
      ) : null}
    </AccountAuthLayout>
  );
}
