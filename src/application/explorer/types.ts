import type { DetourCategory } from "@/domain/events/classify-event-category";
import type { DetourEvent } from "@/domain/events/event";
import type { V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";

/**
 * Contrat public Explorer — filtres supportés.
 * radiusKm : hors contrat (reporté).
 */
export type ListExplorerEventsQuery = {
  when: WhenFilter;
  search?: string | null;
  /** Taxonomie produit Détour — filtre `product_category`. */
  category?: DetourCategory | null;
  /** Commune V1 canonique — filtre `city_key`. */
  city?: V1Commune | null;
  cursor?: string | null;
  /** Défaut 12, borné côté application. */
  limit?: number;
  /**
   * Fenêtre civile Paris optionnelle (`YYYY-MM-DD`), réservée à `when: "upcoming"`.
   * Filtre : `start_at` dans [from, to] et événement encore à venir.
   */
  from?: string;
  to?: string;
};

export type ListExplorerEventsResult = {
  events: DetourEvent[];
  /**
   * Compte des groupes dédupliqués.
   * - `number` sur la première page (sans curseur), y compris `0`.
   * - `null` sur une page suivante : le compte n’est pas recalculé.
   */
  totalCount: number | null;
  nextCursor: string | null;
};

export const EXPLORER_DEFAULT_PAGE_SIZE = 12;
export const EXPLORER_MAX_PAGE_SIZE = 50;
export const EXPLORER_SEARCH_MAX_LENGTH = 80;
