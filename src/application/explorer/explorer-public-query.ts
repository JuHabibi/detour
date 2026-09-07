import {
  DETOUR_CATEGORIES,
  type DetourCategory,
} from "@/domain/events/classify-event-category";
import { V1_COMMUNES, type V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";
import type { CategoryId } from "@/data/types";
import type { ListExplorerEventsQuery } from "@/application/explorer/types";

const WHEN_FILTERS: readonly WhenFilter[] = [
  "today",
  "tomorrow",
  "weekend",
  "next-week",
  "this-month",
  "next-month",
  "upcoming",
] as const;

export type ExplorerPublicInput = {
  when: string;
  search?: string | null;
  category?: string | null;
  city?: string | null;
  cursor?: string | null;
};

export type ParsedExplorerQuery =
  | { ok: true; query: ListExplorerEventsQuery }
  | { ok: false; error: string };

export function isWhenFilter(value: string): value is WhenFilter {
  return (WHEN_FILTERS as readonly string[]).includes(value);
}

export function isDetourCategory(value: string): value is DetourCategory {
  return (DETOUR_CATEGORIES as readonly string[]).includes(value);
}

export function isV1Commune(value: string): value is V1Commune {
  return (V1_COMMUNES as readonly string[]).includes(value);
}

/** UI `"tout"` → pas de filtre backend. */
export function categoryIdToExplorerFilter(
  category: CategoryId,
): DetourCategory | undefined {
  if (category === "tout") return undefined;
  return category;
}

/** UI « Toutes les villes » (null) → pas de filtre backend. */
export function cityToExplorerFilter(
  city: V1Commune | null,
): V1Commune | undefined {
  return city ?? undefined;
}

/** Valide l’entrée publique et construit la query read model. */
export function parseExplorerPublicInput(
  input: ExplorerPublicInput,
): ParsedExplorerQuery {
  if (!isWhenFilter(input.when)) {
    return { ok: false, error: "Période invalide." };
  }

  let category: DetourCategory | undefined;
  if (input.category != null && input.category !== "" && input.category !== "tout") {
    if (!isDetourCategory(input.category)) {
      return { ok: false, error: "Catégorie invalide." };
    }
    category = input.category;
  }

  let city: V1Commune | undefined;
  if (input.city != null && input.city !== "") {
    if (!isV1Commune(input.city)) {
      return { ok: false, error: "Ville invalide." };
    }
    city = input.city;
  }

  const cursor =
    input.cursor != null && input.cursor !== "" ? input.cursor : undefined;

  return {
    ok: true,
    query: {
      when: input.when,
      search: input.search,
      category,
      city,
      cursor,
      limit: 12,
    },
  };
}

export function isStaleExplorerRequest(
  requestSeq: number,
  latestSeq: number,
): boolean {
  return requestSeq !== latestSeq;
}
