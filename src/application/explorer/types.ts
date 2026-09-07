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
};

export type ListExplorerEventsResult = {
  events: DetourEvent[];
  totalCount: number;
  nextCursor: string | null;
};

export const EXPLORER_DEFAULT_PAGE_SIZE = 12;
export const EXPLORER_MAX_PAGE_SIZE = 50;
export const EXPLORER_SEARCH_MAX_LENGTH = 80;
