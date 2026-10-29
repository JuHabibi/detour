import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import {
  EXPLORER_URL_DEFAULTS,
  sameExplorerUrlState,
  type ExplorerUrlState,
} from "@/features/explorer/explorer-url-state";
import { getCachedPublicExplorerInitialPage } from "@/infrastructure/next-public-explorer-cache";
import {
  PUBLIC_EXPLORER_INITIAL_LIMIT,
  PUBLIC_EXPLORER_INITIAL_WHEN,
} from "@/application/explorer/get-public-explorer-initial-page";
import { categoryIdToExplorerFilter } from "@/application/explorer/explorer-public-query";

/**
 * Charge la page Explorer publique.
 * Défaut weekend → cache ISR ; autres filtres URL → lecture directe.
 */
export async function loadExplorerPage(filters: ExplorerUrlState = EXPLORER_URL_DEFAULTS) {
  const isDefaultWeekend = sameExplorerUrlState(filters, EXPLORER_URL_DEFAULTS);

  if (isDefaultWeekend) {
    const explorer = await getCachedPublicExplorerInitialPage();
    return { explorer, initialFilters: filters };
  }

  const result = await listExplorerEvents({
    when: filters.when,
    from: filters.from ?? undefined,
    to: filters.to ?? undefined,
    search: filters.q || undefined,
    category: categoryIdToExplorerFilter(filters.category),
    city: filters.city ?? undefined,
    limit: PUBLIC_EXPLORER_INITIAL_LIMIT,
  });

  if (typeof result.totalCount !== "number") {
    throw new Error("Explorer page requires a numeric totalCount");
  }

  return {
    explorer: {
      events: result.events.map((event) => mapDetourEventToEventItem(event)),
      totalCount: result.totalCount,
      nextCursor: result.nextCursor,
    },
    initialFilters: filters,
  };
}

/** Exposé pour tests / doc — défauts alignés cache public. */
export const LOAD_EXPLORER_PAGE_DEFAULT_WHEN = PUBLIC_EXPLORER_INITIAL_WHEN;
