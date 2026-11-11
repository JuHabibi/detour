"use client";

import type { ReactNode } from "react";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";
import { DeferredPersonalizationCue } from "./DeferredPersonalizationCue";
import {
  ForYouEmptyState,
  ForYouErrorState,
  ForYouLoadingPlaceholder,
  ForYouSection,
} from "./ForYouSection";
import { PersonalizationGate } from "./PersonalizationGate";
import { PersonalizationOnboarding } from "./PersonalizationOnboarding";
import { usePersonalizationHome } from "./use-personalization-home";

type PersonalizationHostProps = {
  userId: string | null;
  /** Affiche la bannière soft sous le Radar si deferred. */
  showHomeCue?: boolean;
  /** Branchement Home — favoris / carnets / détail. */
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  carnetCounts?: Map<string, number>;
  onOrganizeCarnets?: (event: EventItem) => void;
  onOpenDetail?: OpenEventDetailHandler;
};

export function PersonalizationHost({
  userId,
  showHomeCue = true,
  favorites,
  onToggleFavorite,
  carnetCounts,
  onOrganizeCarnets,
  onOpenDetail,
}: PersonalizationHostProps) {
  const perso = usePersonalizationHome(userId);

  const canRenderCarousel =
    Boolean(favorites) && typeof onToggleFavorite === "function";

  let forYouBlock: ReactNode = null;
  if (canRenderCarousel && userId) {
    const state = perso.forYouState;
    if (state.status === "loading" || state.status === "idle") {
      // Réserve l’espace tant que le bundle Home n’a pas tranché.
      forYouBlock = <ForYouLoadingPlaceholder />;
    } else if (state.status === "error") {
      forYouBlock = (
        <ForYouErrorState onRetry={() => void perso.refreshForYou()} />
      );
    } else if (state.status === "empty") {
      forYouBlock = <ForYouEmptyState onEditPreferences={perso.openEditor} />;
    } else if (state.status === "ready") {
      forYouBlock = (
        <ForYouSection
          events={state.events}
          favorites={favorites!}
          onToggleFavorite={onToggleFavorite!}
          carnetCounts={carnetCounts}
          onOrganizeCarnets={onOrganizeCarnets}
          onOpenDetail={onOpenDetail}
          onEditPreferences={perso.openEditor}
        />
      );
    }
    // not_configured → rien (gate / deferred cue gèrent le reste)
  }

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

      {forYouBlock}

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

export { usePersonalization } from "./use-personalization";
