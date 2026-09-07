import type { DetourEvent } from "@/domain/events/event";
import type { WhenFilter } from "@/domain/time/when-filter";

/**
 * Contrat public Explorer — filtres réellement supportés.
 * category / city / radiusKm : hors contrat (migration + sémantique à venir).
 */
export type ListExplorerEventsQuery = {
  when: WhenFilter;
  search?: string | null;
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
