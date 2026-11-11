"use client";

import { AppModal } from "@/components/ui/AppModal";

type PersonalizationGateProps = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onConfigure: () => void;
  onLater: () => void;
};

export function PersonalizationGate({
  open,
  busy = false,
  error = null,
  onConfigure,
  onLater,
}: PersonalizationGateProps) {
  if (!open) return null;

  return (
    <AppModal
      eyebrow="Découvertes pour vous"
      title="Personnaliser vos sorties ?"
      description="Trois questions rapides pour proposer une sélection à côté du Radar. Vous pourrez modifier ou ignorer à tout moment."
      onClose={() => {
        if (!busy) onLater();
      }}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onLater}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-sand underline decoration-line underline-offset-4 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {busy ? "Enregistrement…" : "Plus tard"}
          </button>
          <button
            type="button"
            onClick={onConfigure}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Configurer maintenant
          </button>
        </div>
      }
    >
      <ul className="space-y-2 text-sm leading-6 text-cream-dim">
        <li>Centres d’intérêt culturels</li>
        <li>Disponibilités habituelles</li>
        <li>Budget confortable</li>
      </ul>
      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={onLater}>
            Réessayer
          </button>
        </p>
      ) : null}
    </AppModal>
  );
}
