"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  accountLoginHref,
  accountSignupHref,
} from "@/lib/safe-account-next-path";
import {
  pathWithPendingFavorite,
  savePendingFavoriteIntent,
} from "@/lib/pending-favorite";

type FavoriteAuthModalProps = {
  eventId: string;
  /** Chemin de retour après auth (défaut `/`). */
  returnPath?: string;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
};

/**
 * Modale invitant à créer un compte pour enregistrer un favori.
 * Persiste l’intention (URL + sessionStorage) avant navigation auth.
 */
export function FavoriteAuthModal({
  eventId,
  returnPath = "/",
  onClose,
  returnFocusTo,
}: FavoriteAuthModalProps) {
  const nextPath = pathWithPendingFavorite(eventId, returnPath);
  const signupHref = accountSignupHref(nextPath);
  const loginHref = accountLoginHref(nextPath);
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    savePendingFavoriteIntent(eventId, returnPath);
  }, [eventId, returnPath]);

  return (
    <AppModal
      eyebrow="Favoris"
      title="Gardez cette découverte."
      description="Créez un compte pour enregistrer cet événement, le retrouver sur tous vos appareils et l’organiser dans vos carnets."
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      footer={
        <>
          <Link
            href={loginHref}
            className="inline-flex min-h-11 items-center border border-line bg-paper px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink"
          >
            J’ai déjà un compte
          </Link>
          <Link
            href={signupHref}
            className="inline-flex min-h-11 items-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
          >
            Créer mon compte
          </Link>
        </>
      }
    >
      <p className="text-sm leading-6 text-cream-dim">
        Radar et Explorer restent ouverts sans inscription. Le compte sert à
        conserver et organiser vos envies.
      </p>
    </AppModal>
  );
}
