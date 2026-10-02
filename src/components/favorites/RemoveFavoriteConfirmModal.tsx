"use client";

import { AppModal } from "@/components/ui/AppModal";

type RemoveFavoriteConfirmModalProps = {
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusTo?: HTMLElement | null;
  pending?: boolean;
};

/**
 * Confirmation avant retrait d’un favori déjà rangé dans au moins un carnet.
 * Partagée compte / home / frise / modale d’organisation.
 */
export function RemoveFavoriteConfirmModal({
  onCancel,
  onConfirm,
  returnFocusTo,
  pending = false,
}: RemoveFavoriteConfirmModalProps) {
  return (
    <AppModal
      eyebrow="Favoris"
      title="Retirer des favoris ?"
      description="Cet événement sera aussi retiré de vos carnets."
      onClose={onCancel}
      returnFocusTo={returnFocusTo}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-11 items-center border border-line bg-paper px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex min-h-11 items-center bg-coral px-5 text-sm font-medium uppercase tracking-[0.1em] text-foam transition-colors hover:bg-ink disabled:opacity-60"
          >
            {pending ? "Retrait…" : "Retirer des favoris et des carnets"}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-cream-dim">
        Vos carnets n’afficheront plus cette découverte. Vous pourrez la
        retrouver plus tard dans le Radar ou Explorer.
      </p>
    </AppModal>
  );
}
