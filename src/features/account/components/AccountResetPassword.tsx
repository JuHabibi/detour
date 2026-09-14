"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/features/account/auth-client";
import { AccountAuthLayout } from "@/features/account/components/AccountAuthLayout";

const fieldClassName =
  "mt-2 h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint";

export function AccountResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Lien de réinitialisation invalide ou expiré.");
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

    setPending(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError("Impossible de réinitialiser le mot de passe. Réessayez.");
        return;
      }
      router.push("/account/login");
      router.refresh();
    } catch {
      setError("Impossible de réinitialiser le mot de passe. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountAuthLayout variant="login">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Nouveau mot de passe
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        Choisissez un mot de passe.
      </h1>
      <p className="mt-5 text-sm leading-6 text-cream-dim md:mt-6">
        Saisissez un nouveau mot de passe pour votre compte Détour.
      </p>

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
          disabled={pending || !token}
          className="inline-flex min-h-11 w-full items-center justify-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

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
