"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { AccountAuthLayout } from "@/features/account/components/AccountAuthLayout";
import { accountSignupHref } from "@/lib/safe-account-next-path";

const fieldClassName =
  "mt-2 h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint";

const AUTH_ERROR_MESSAGE =
  "Impossible de se connecter. Vérifiez votre email et votre mot de passe.";

const showForgotPassword = process.env.NODE_ENV !== "production";

type AccountLoginProps = {
  /** Cible post-connexion (déjà validée côté serveur). */
  nextPath?: string;
};

export function AccountLogin({ nextPath = "/account" }: AccountLoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        setError(AUTH_ERROR_MESSAGE);
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError(AUTH_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  const heading =
    nextPath.startsWith("/frise")
      ? "Mon parcours culturel vous attend."
      : "Retrouvez vos détours.";
  const lead =
    nextPath.startsWith("/frise")
      ? "Connectez-vous pour reprendre mon parcours culturel — favoris et compte inclus."
      : "Connectez-vous pour accéder à vos favoris et les ajouter à votre agenda.";

  return (
    <AccountAuthLayout variant="login">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Connexion
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        {heading}
      </h1>
      <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">{lead}</p>

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

        <label className="block">
          <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
            Mot de passe
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={fieldClassName}
          />
        </label>

        {showForgotPassword ? (
          <div className="flex justify-end">
            <Link
              href="/account/forgot-password"
              className="text-[12px] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-ink"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        ) : null}

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
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className="mt-8 text-sm text-cream-dim">
        Pas encore de compte ?{" "}
        <Link
          href={accountSignupHref(nextPath === "/account" ? null : nextPath)}
          className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral"
        >
          Créer un compte
        </Link>
      </p>
    </AccountAuthLayout>
  );
}

