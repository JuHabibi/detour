"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/features/account/auth-client";
import { AccountAuthLayout } from "@/features/account/components/AccountAuthLayout";

const fieldClassName =
  "mt-2 h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint";

const AUTH_ERROR_MESSAGE =
  "Impossible de créer le compte. Vérifiez vos informations ou réessayez.";

export function AccountSignup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPending(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (result.error) {
        setError(AUTH_ERROR_MESSAGE);
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError(AUTH_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountAuthLayout variant="signup">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Création de compte
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        Gardez ce qui compte.
      </h1>
      <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
        Un compte simple pour retrouver vos favoris et les glisser dans votre
        agenda.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5 md:mt-12">
        <label className="block">
          <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
            Nom
          </span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Camille R."
            className={fieldClassName}
          />
        </label>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={fieldClassName}
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
            Confirmer le mot de passe
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
          {pending ? "Création…" : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-8 text-sm text-cream-dim">
        Déjà inscrit ?{" "}
        <Link
          href="/account/login"
          className="font-medium text-ink underline decoration-mint/70 decoration-2 underline-offset-4 hover:decoration-coral"
        >
          J’ai déjà un compte
        </Link>
      </p>
    </AccountAuthLayout>
  );
}
