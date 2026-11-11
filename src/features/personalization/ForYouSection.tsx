"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OpenEventDetailHandler } from "@/components/event/EventDetailModal";
import type { EventItem } from "@/data/types";
import { FeaturedEventsCarousel } from "@/features/home/components/radar/FeaturedEventsCarousel";

type ForYouSectionProps = {
  events: EventItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  carnetCounts?: Map<string, number>;
  onOrganizeCarnets?: (event: EventItem) => void;
  onOpenDetail?: OpenEventDetailHandler;
  onEditPreferences: () => void;
};

/**
 * Carrousel « Pour vous » — événements déjà sélectionnés côté serveur.
 */
export function ForYouSection({
  events,
  favorites,
  onToggleFavorite,
  carnetCounts,
  onOrganizeCarnets,
  onOpenDetail,
  onEditPreferences,
}: ForYouSectionProps) {
  if (events.length === 0) return null;

  return (
    <section
      id="pour-vous"
      aria-labelledby="for-you-title"
      className="scroll-mt-20 border-t border-line bg-paper"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 py-7 md:px-10 md:py-9 lg:px-16 2xl:px-20">
        <ForYouHeader onEditPreferences={onEditPreferences} />

        <FeaturedEventsCarousel
          events={events}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          carnetCounts={carnetCounts}
          onOrganizeCarnets={onOrganizeCarnets}
          onOpenDetail={onOpenDetail}
          ariaLabel="Pour vous — sélection personnalisée"
        />
      </div>
    </section>
  );
}

type ForYouEmptyProps = {
  onEditPreferences: () => void;
};

/** État vide discret — aucune suggestion hors centres d’intérêt. */
export function ForYouEmptyState({ onEditPreferences }: ForYouEmptyProps) {
  return (
    <section
      id="pour-vous"
      aria-labelledby="for-you-empty-title"
      className="scroll-mt-20 border-t border-line bg-paper"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 py-6 md:px-10 md:py-7 lg:px-16 2xl:px-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
          Sélection personnelle
        </p>
        <h2
          id="for-you-empty-title"
          className="mt-2 font-display text-[1.35rem] leading-tight tracking-tight text-ink md:text-[1.6rem]"
        >
          ✦ Pour vous
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-cream-dim">
          Aucune sortie à venir ne correspond assez à vos centres d’intérêt pour
          l’instant. Ajustez vos préférences ou parcourez Explorer.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onEditPreferences}
            className="inline-flex min-h-11 w-fit items-center border border-ink/25 bg-foam px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Modifier mes préférences
          </button>
          <Link
            href="/explorer"
            className="inline-flex min-h-11 w-fit items-center px-1 text-[12px] font-medium uppercase tracking-[0.1em] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Voir Explorer
          </Link>
        </div>
      </div>
    </section>
  );
}

type ForYouErrorProps = {
  onRetry: () => void;
};

/** Erreur contrôlée — ne pas confondre avec une absence d’événements. */
export function ForYouErrorState({ onRetry }: ForYouErrorProps) {
  return (
    <section
      id="pour-vous"
      aria-label="Pour vous — erreur de chargement"
      className="scroll-mt-20 border-t border-line bg-paper"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 py-5 md:px-10 lg:px-16 2xl:px-20">
        <p className="text-sm text-coral" role="alert">
          Impossible de charger votre sélection.{" "}
          <button type="button" className="underline" onClick={onRetry}>
            Réessayer
          </button>
        </p>
      </div>
    </section>
  );
}

const FOR_YOU_PLACEHOLDER_DELAY_MS = 200;

const PLACEHOLDER_CARD_WIDTH =
  "w-[64%] shrink-0 sm:w-[36%] md:w-[28%] lg:w-[22%] 2xl:w-[20%]";

/**
 * Placeholder discret — réserve la hauteur du carrousel pendant le chargement.
 * Le squelette n’apparaît qu’après ~200 ms (évite les flashs sur réseau rapide).
 * Pas de prolongation artificielle une fois les données prêtes (le parent démonte).
 */
export function ForYouLoadingPlaceholder() {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSkeleton(true);
    }, FOR_YOU_PLACEHOLDER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section
      id="pour-vous"
      aria-busy="true"
      aria-label="Pour vous — chargement"
      className="scroll-mt-20 border-t border-line bg-paper"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 py-7 md:px-10 md:py-9 lg:px-16 2xl:px-20">
        <div className="mb-6 h-16 max-w-xl md:mb-8 md:h-[4.5rem]" aria-hidden />
        {showSkeleton ? (
          <div
            className="flex gap-3 overflow-hidden motion-safe:animate-pulse md:gap-4"
            aria-hidden
          >
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={PLACEHOLDER_CARD_WIDTH}>
                <div className="aspect-[4/5] bg-foam/70" />
                <div className="mt-3 h-3 w-3/4 bg-foam/55" />
                <div className="mt-2 h-2.5 w-1/2 bg-foam/40" />
              </div>
            ))}
          </div>
        ) : (
          // Réserve la géométrie carrousel sans peindre le squelette.
          <div className="h-[17.5rem] w-full md:h-[19rem]" aria-hidden />
        )}
      </div>
    </section>
  );
}

function ForYouHeader({ onEditPreferences }: { onEditPreferences: () => void }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
          Sélection personnelle
        </p>
        <h2
          id="for-you-title"
          className="mt-2 font-display text-[1.65rem] leading-[1.05] tracking-tight text-ink md:text-[2.1rem]"
        >
          ✦ Pour vous
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-cream-dim">
          Une piste selon vos préférences, en complément du Radar, sans le
          remplacer.
        </p>
      </div>
      <button
        type="button"
        onClick={onEditPreferences}
        className="inline-flex min-h-11 w-fit items-center border border-ink/25 bg-foam px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Modifier mes préférences
      </button>
    </div>
  );
}
