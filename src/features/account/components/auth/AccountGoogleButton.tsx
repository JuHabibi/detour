"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  extractPendingFavoriteIdFromPath,
  savePendingFavoriteIntent,
} from "@/lib/pending-favorite";
import {
  accountLoginHref,
  accountSignupHref,
} from "@/lib/safe-account-next-path";

type AccountGoogleButtonProps = {
  nextPath: string;
  /** Page courante — sert de `errorCallbackURL` après échec / annulation OAuth. */
  variant: "login" | "signup";
  onError: (message: string) => void;
};

const START_ERROR =
  "Impossible de continuer avec Google. Réessayez ou utilisez votre email.";

/**
 * Démarre le redirect OAuth Google via Better Auth.
 * Persiste l’intention favori avant de quitter la page.
 */
export function AccountGoogleButton({
  nextPath,
  variant,
  onError,
}: AccountGoogleButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    onError("");
    const pendingFavoriteId = extractPendingFavoriteIdFromPath(nextPath);
    if (pendingFavoriteId) {
      savePendingFavoriteIntent(pendingFavoriteId, nextPath);
    }

    const errorCallbackURL =
      variant === "login"
        ? accountLoginHref(nextPath === "/account" ? null : nextPath)
        : accountSignupHref(nextPath === "/account" ? null : nextPath);

    setPending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: nextPath,
        errorCallbackURL,
      });
      if (result.error) {
        onError(START_ERROR);
        setPending(false);
      }
      // Succès : Better Auth redirige vers Google ; pas de reset pending.
    } catch {
      onError(START_ERROR);
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void handleClick()}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2.5 border border-line bg-paper px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink hover:bg-foam disabled:opacity-60"
    >
      <GoogleMark />
      {pending ? "Redirection…" : "Continuer avec Google"}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
