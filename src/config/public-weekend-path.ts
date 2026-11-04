import { PUBLIC_TERRITORY_SLUG } from "@/config/public-territory";

/**
 * URL permanente « Ce week-end » pour le territoire public V1.
 * Dérivée du slug config — pas de constante géographique dans le métier.
 */
export function publicWeekendPath(
  territorySlug: string = PUBLIC_TERRITORY_SLUG,
): string {
  return `/${territorySlug}/ce-week-end`;
}
