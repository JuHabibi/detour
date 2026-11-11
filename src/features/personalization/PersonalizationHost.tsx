"use client";

import { DeferredPersonalizationCue } from "./DeferredPersonalizationCue";
import { PersonalizationGate } from "./PersonalizationGate";
import { PersonalizationOnboarding } from "./PersonalizationOnboarding";
import { usePersonalization } from "./use-personalization";

type PersonalizationHostProps = {
  userId: string | null;
  /** Affiche la bannière soft sous le Radar si deferred. */
  showHomeCue?: boolean;
};

export function PersonalizationHost({
  userId,
  showHomeCue = true,
}: PersonalizationHostProps) {
  const perso = usePersonalization(userId);

  return (
    <>
      {perso.loadError ? (
        <div className="border-b border-line px-5 py-3 md:px-8 lg:px-12 2xl:px-14">
          <p className="mx-auto max-w-[var(--detour-shell-max)] text-sm text-coral" role="alert">
            {perso.loadError}{" "}
            <button type="button" className="underline" onClick={perso.refresh}>
              Réessayer
            </button>
          </p>
        </div>
      ) : null}

      {showHomeCue && perso.showDeferredCue ? (
        <DeferredPersonalizationCue onConfigure={perso.openEditor} />
      ) : null}

      <PersonalizationGate
        open={perso.showGate}
        busy={perso.busy}
        error={perso.saveError}
        onConfigure={perso.openEditor}
        onLater={() => {
          void perso.defer();
        }}
      />

      {perso.onboardingOpen ? (
        <PersonalizationOnboarding
          initialPreferences={perso.draft}
          busy={perso.busy}
          error={perso.saveError}
          onClose={perso.closeOnboarding}
          onDefer={() => {
            void perso.defer();
          }}
          onComplete={(write) => {
            void perso.complete(write);
          }}
        />
      ) : null}
    </>
  );
}

export { usePersonalization };
