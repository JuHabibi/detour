"use server";

import {
  parseExplorerPublicInput,
  type ExplorerPublicInput,
} from "@/application/explorer/explorer-public-query";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { EventItem } from "@/data/types";

export type LoadExplorerEventsInput = ExplorerPublicInput;

export type LoadExplorerEventsResult =
  | {
      ok: true;
      events: EventItem[];
      totalCount: number;
      nextCursor: string | null;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Charge une page Explorer (filtres + keyset).
 * Entrée validée — jamais de SQL libre depuis le client.
 */
export async function loadExplorerEvents(
  input: LoadExplorerEventsInput,
): Promise<LoadExplorerEventsResult> {
  const parsed = parseExplorerPublicInput(input);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  try {
    const result = await listExplorerEvents(parsed.query);
    return {
      ok: true,
      events: result.events.map((event) => mapDetourEventToEventItem(event)),
      totalCount: result.totalCount,
      nextCursor: result.nextCursor,
    };
  } catch {
    return { ok: false, error: "Impossible de charger les sorties." };
  }
}
