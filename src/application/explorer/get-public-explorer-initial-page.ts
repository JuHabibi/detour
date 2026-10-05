import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import type { EventItem } from "@/data/types";

/** Filtres initiaux alignés serveur ↔ client Explorer. */
export const PUBLIC_EXPLORER_INITIAL_WHEN = "weekend" as const;
export const PUBLIC_EXPLORER_INITIAL_LIMIT = 12;

/** Première page Explorer publique — hors pipeline Radar / IA. */
export type PublicExplorerInitialPage = {
  events: EventItem[];
  totalCount: number;
  nextCursor: string | null;
};

/**
 * Charge la 1ʳᵉ page Explorer (totalCount numérique requis).
 * Ne déclenche pas EventService / Radar / IA.
 */
export async function getPublicExplorerInitialPage(): Promise<PublicExplorerInitialPage> {
  const page = await listExplorerEvents({
    when: PUBLIC_EXPLORER_INITIAL_WHEN,
    limit: PUBLIC_EXPLORER_INITIAL_LIMIT,
  });

  if (typeof page.totalCount !== "number") {
    throw new Error(
      "Public explorer initial page requires a numeric totalCount",
    );
  }

  return {
    events: page.events.map((event) => mapDetourEventToEventItem(event)),
    totalCount: page.totalCount,
    nextCursor: page.nextCursor,
  };
}
