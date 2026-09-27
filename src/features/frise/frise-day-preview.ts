import { EXPLORER_FRIEZE_DAY_PREVIEW } from "@/features/frise/frise-timeline-model";
import type { EventItem } from "@/data/types";

export type FriseDayPreview = {
  /** Cartes affichées dans la frise (≤ previewLimit). */
  visible: EventItem[];
  /** Événements restants (non affichés en frise). */
  hidden: EventItem[];
  /** Nombre d’événements non affichés en frise. */
  restCount: number;
  total: number;
  /** Tous les événements du jour (ordre source). */
  all: EventItem[];
};

/**
 * Découpe d’affichage frise : 2 cartes max visibles, le reste via panneau.
 * Ne modifie pas les données — pure présentation.
 */
export function sliceFriseDayPreview(
  events: readonly EventItem[],
  previewLimit: number = EXPLORER_FRIEZE_DAY_PREVIEW,
): FriseDayPreview {
  const limit = Math.max(0, previewLimit);
  const all = [...events];
  const visible = all.slice(0, limit);
  const hidden = all.slice(limit);
  return {
    visible,
    hidden,
    restCount: hidden.length,
    total: all.length,
    all,
  };
}

export function friseDayMoreLabel(restCount: number): string {
  if (restCount <= 0) return "";
  if (restCount === 1) return "Voir l’autre événement";
  return `Voir les ${restCount} autres événements`;
}
