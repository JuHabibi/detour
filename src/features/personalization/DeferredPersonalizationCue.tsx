"use client";

type DeferredPersonalizationCueProps = {
  onConfigure: () => void;
};

/** Bannière soft — pas une relance forcée de l’onboarding. */
export function DeferredPersonalizationCue({
  onConfigure,
}: DeferredPersonalizationCueProps) {
  return (
    <section
      aria-label="Personnalisation en attente"
      className="border-t border-line bg-foam"
    >
      <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-col gap-3 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-10 lg:px-16 2xl:px-20">
        <p className="max-w-xl text-sm leading-6 text-cream-dim">
          Vos découvertes peuvent encore s’affiner. Trois questions, puis une
          section « Pour vous » sous le Radar.
        </p>
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex min-h-11 w-fit shrink-0 items-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Personnaliser maintenant
        </button>
      </div>
    </section>
  );
}
