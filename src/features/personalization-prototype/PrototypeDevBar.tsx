"use client";

type PrototypeDevBarProps = {
  prototypeSignedIn: boolean;
  onEnableSession: () => void;
  onDisableSession: () => void;
  onReset: () => void;
  onOpenOnboarding: () => void;
};

/** Barre de test locale — hors parcours produit final. */
export function PrototypeDevBar({
  prototypeSignedIn,
  onEnableSession,
  onDisableSession,
  onReset,
  onOpenOnboarding,
}: PrototypeDevBarProps) {
  return (
    <div className="fixed bottom-3 left-3 z-[60] max-w-[min(100vw-1.5rem,22rem)] border border-line bg-foam/95 p-3 text-[11px] text-ink shadow-sm backdrop-blur-sm">
      <p className="font-medium uppercase tracking-[0.14em] text-sand">
        Prototype perso
      </p>
      <p className="mt-1 leading-4 text-cream-dim">
        État local uniquement. Aucune écriture serveur.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {prototypeSignedIn ? (
          <button
            type="button"
            onClick={onDisableSession}
            className="min-h-9 border border-ink/20 px-2.5 uppercase tracking-[0.08em] hover:border-ink"
          >
            Quitter session test
          </button>
        ) : (
          <button
            type="button"
            onClick={onEnableSession}
            className="min-h-9 bg-mint px-2.5 uppercase tracking-[0.08em] hover:bg-ink hover:text-foam"
          >
            Simuler connexion
          </button>
        )}
        <button
          type="button"
          onClick={onOpenOnboarding}
          className="min-h-9 border border-ink/20 px-2.5 uppercase tracking-[0.08em] hover:border-ink"
        >
          Ouvrir onboarding
        </button>
        <button
          type="button"
          onClick={onReset}
          className="min-h-9 border border-ink/20 px-2.5 uppercase tracking-[0.08em] hover:border-ink"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
