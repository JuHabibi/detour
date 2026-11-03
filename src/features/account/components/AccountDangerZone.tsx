"use client";

import { useId, useState, type FormEvent } from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  DELETE_ACCOUNT_EMAIL_SENT,
  DELETE_ACCOUNT_GENERIC_ERROR,
  mapDeleteAccountClientError,
} from "@/features/account/components/auth/account-delete-feedback";
import { ACCOUNT_DELETED_CALLBACK_PATH } from "@/features/account/components/auth/account-deleted-path";
import { authClient } from "@/lib/auth-client";

const fieldClassName =
  "mt-2 h-11 w-full border border-line bg-foam px-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint";

type AccountDangerZoneProps = {
  /** True si le user a un provider `credential` avec mot de passe (y compris multi-providers). */
  requiresPassword: boolean;
};

export function AccountDangerZone({ requiresPassword }: AccountDangerZoneProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setPassword("");
    setError(null);
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await authClient.deleteUser({
        ...(requiresPassword ? { password } : {}),
        callbackURL: ACCOUNT_DELETED_CALLBACK_PATH,
      });

      if (result.error) {
        setError(mapDeleteAccountClientError(result.error.code));
        setEmailSent(false);
        return;
      }

      const message =
        typeof result.data === "object" &&
        result.data !== null &&
        "message" in result.data &&
        typeof result.data.message === "string"
          ? result.data.message
          : "";

      if (message === "User deleted") {
        // Ne devrait pas arriver avec sendDeleteAccountVerification actif.
        window.location.assign(ACCOUNT_DELETED_CALLBACK_PATH);
        return;
      }

      setEmailSent(true);
      setOpen(false);
      setPassword("");
    } catch {
      setError(DELETE_ACCOUNT_GENERIC_ERROR);
      setEmailSent(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="mt-16 border-t border-line pt-10 md:mt-20 md:pt-12"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-coral">
        Zone sensible
      </p>
      <h2
        id={titleId}
        className="mt-3 font-display text-[1.45rem] tracking-tight text-ink md:text-[1.65rem]"
      >
        Supprimer mon compte
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-cream-dim">
        Cette action est définitive. Vos favoris, carnets et données de
        connexion seront effacés. Les événements culturels publics ne sont pas
        concernés.
      </p>

      {emailSent ? (
        <p className="mt-6 max-w-xl text-sm leading-6 text-cream-dim" role="status">
          {DELETE_ACCOUNT_EMAIL_SENT}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="mt-6 inline-flex min-h-11 items-center border border-coral/40 bg-foam px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-coral transition-colors hover:border-coral hover:bg-coral hover:text-foam"
        >
          Supprimer définitivement mon compte
        </button>
      )}

      {open ? (
        <AppModal
          eyebrow="Zone sensible"
          title="Confirmer la suppression ?"
          description="Cette action ne peut pas être annulée après confirmation par email."
          onClose={closeModal}
          footer={
            <>
              <button
                type="button"
                onClick={closeModal}
                disabled={pending}
                className="inline-flex min-h-11 items-center border border-line bg-paper px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="account-delete-form"
                disabled={pending || (requiresPassword && !password)}
                className="inline-flex min-h-11 items-center bg-coral px-5 text-sm font-medium uppercase tracking-[0.1em] text-foam transition-colors hover:bg-ink disabled:opacity-60"
              >
                {pending ? "Envoi…" : "Envoyer le lien de confirmation"}
              </button>
            </>
          }
        >
          <form id="account-delete-form" onSubmit={handleConfirm} className="space-y-4">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-cream-dim">
              <li>Favoris et carnets personnels : définitivement effacés.</li>
              <li>Sessions et connexions : révoquées immédiatement après confirmation.</li>
              <li>Événements culturels publics : conservés (catalogue Détour).</li>
              <li>
                Un email de confirmation est obligatoire
                {requiresPassword
                  ? ", après vérification de votre mot de passe"
                  : ""}
                .
              </li>
            </ul>

            {requiresPassword ? (
              <label className="block">
                <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand">
                  Mot de passe
                </span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClassName}
                />
              </label>
            ) : (
              <p className="text-sm leading-6 text-cream-dim">
                Compte Google : la suppression ne sera effective qu’après le
                clic sur le lien reçu par email, en restant connecté.
              </p>
            )}

            {error ? (
              <p className="text-sm text-coral" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </AppModal>
      ) : null}
    </section>
  );
}
