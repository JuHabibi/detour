"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/app/actions/account-auth";
import { AccountAuthLayout } from "@/features/account/components/AccountAuthLayout";

const fieldClassName =
  "mt-2 h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint";

export function AccountForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/account/reset-password`,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch {
      setError(
        "Impossible d’envoyer la demande pour le moment. Réessayez plus tard.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountAuthLayout variant="login">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Mot de passe oublié
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        Réinitialisez l’accès.
      </h1>
      <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
        Entrez votre email. Si un compte existe, un lien de réinitialisation
        sera préparé.
      </p>

      {done ? (
        <p className="mt-10 text-sm leading-6 text-cream-dim md:mt-12">
          Si un compte correspond à cet email, un lien a été généré. En
          développement, consultez les logs serveur.
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
            {pending ? "Envoi…" : "Envoyer le lien"}
          </button>
        </form>
      )}

      <p className="mt-8 text-sm text-cream-dim">
        <Link
          href="/account/login"
          className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral"
        >
          Retour à la connexion
        </Link>
      </p>
    </AccountAuthLayout>
  );
}
