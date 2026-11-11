"use client";

import { PersonalizationOnboarding } from "./PersonalizationOnboarding";
import { usePersonalization } from "./use-personalization";

type AccountPreferencesSectionProps = {
  userId: string;
};

export function AccountPreferencesSection({
  userId,
}: AccountPreferencesSectionProps) {
  const perso = usePersonalization(userId);

  const statusLabel = !perso.hydrated
    ? "Chargement…"
    : perso.isConfigured
      ? "Configurées"
      : perso.profile?.onboardingStatus === "deferred"
        ? "À reprendre"
        : "Non configurées";

  return (
    <section aria-labelledby="account-prefs-title" className="mt-10 md:mt-12">
      <h2
        id="account-prefs-title"
        className="text-[12px] font-medium uppercase tracking-[0.1em] text-sand"
      >
        Mes préférences culturelles
      </h2>
      <p className="mt-2 text-sm leading-6 text-cream-dim">
        Centres d’intérêt, disponibilités et budget pour affiner vos
        découvertes.
      </p>
      <p className="mt-3 text-sm text-ink">
        État : <span className="font-medium">{statusLabel}</span>
      </p>

      {perso.loadError ? (
        <p className="mt-3 text-sm text-coral" role="alert">
          {perso.loadError}{" "}
          <button type="button" className="underline" onClick={perso.refresh}>
            Réessayer
          </button>
        </p>
      ) : null}

      <button
        type="button"
        onClick={perso.openEditor}
        disabled={!perso.hydrated}
        className="mt-5 inline-flex min-h-11 items-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {perso.isConfigured
          ? "Modifier mes préférences"
          : "Configurer mes préférences"}
      </button>

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
    </section>
  );
}
