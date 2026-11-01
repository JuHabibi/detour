import {
  EXPLORER_AUDIENCE_JEUNE_PUBLIC,
  type ExplorerAudienceId,
} from "@/domain/events/audience-jeune-public";
import {
  DETOUR_CATEGORIES,
  type DetourCategory,
} from "@/domain/events/classify-event-category";
import { V1_COMMUNES, type V1Commune } from "@/domain/geo/v1-communes";
import { isParisDateKey, type WhenFilter } from "@/domain/time/when-filter";
import type { CategoryId } from "@/data/types";
import {
  EXPLORER_DEFAULT_PAGE_SIZE,
  EXPLORER_MAX_PAGE_SIZE,
  type ListExplorerEventsQuery,
} from "@/application/explorer/types";

const WHEN_FILTERS: readonly WhenFilter[] = [
  "today",
  "tomorrow",
  "weekend",
  "next-week",
  "this-month",
  "next-month",
  "upcoming",
  "range",
] as const;

export type ExplorerPublicInput = {
  when: string;
  search?: string | null;
  category?: string | null;
  /** Facette audience : `jeune_public` ou vide. */
  audience?: string | null;
  city?: string | null;
  cursor?: string | null;
  /** Défaut 12, plafonné à EXPLORER_MAX_PAGE_SIZE. */
  limit?: number | null;
  /** Début inclus de fenêtre civile Paris (`YYYY-MM-DD`), avec `to`. */
  from?: string | null;
  /** Fin inclusive de fenêtre civile Paris (`YYYY-MM-DD`), avec `from`. */
  to?: string | null;
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

export function isExplorerAudience(
  value: string,
): value is ExplorerAudienceId {
  return value === EXPLORER_AUDIENCE_JEUNE_PUBLIC;
}

/**
 * UI / URL catégorie → filtre type.
 * Alias lecture `jeune_public` → catégorie historique « Jeune public »
 * (rétrocompat liens fautifs ; distinct de la facette `audience`).
 */
export function parseExplorerCategoryParam(
  raw: string | null | undefined,
): CategoryId | null {
  if (raw == null || raw === "") return null;
  if (raw === "tout") return "tout";
  if (raw === EXPLORER_AUDIENCE_JEUNE_PUBLIC) return "Jeune public";
  if (isDetourCategory(raw)) return raw;
  return null;
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
    const parsedCategory = parseExplorerCategoryParam(input.category);
    if (parsedCategory == null || parsedCategory === "tout") {
      return { ok: false, error: "Catégorie invalide." };
    }
    category = parsedCategory;
  }

  let audience: ExplorerAudienceId | undefined;
  if (input.audience != null && input.audience !== "") {
    if (!isExplorerAudience(input.audience)) {
      return { ok: false, error: "Public invalide." };
    }
    audience = input.audience;
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

  let limit = EXPLORER_DEFAULT_PAGE_SIZE;
  if (input.limit != null && Number.isFinite(input.limit)) {
    limit = Math.min(
      Math.max(1, Math.floor(input.limit)),
      EXPLORER_MAX_PAGE_SIZE,
    );
  }

  const rawFrom =
    input.from != null && input.from !== "" ? input.from.trim() : undefined;
  const rawTo =
    input.to != null && input.to !== "" ? input.to.trim() : undefined;

  if ((rawFrom == null) !== (rawTo == null)) {
    return { ok: false, error: "Période invalide." };
  }

  let from: string | undefined;
  let to: string | undefined;
  if (rawFrom != null && rawTo != null) {
    if (input.when !== "upcoming" && input.when !== "range") {
      return { ok: false, error: "Période invalide." };
    }
    if (!isParisDateKey(rawFrom) || !isParisDateKey(rawTo) || rawFrom > rawTo) {
      return { ok: false, error: "Période invalide." };
    }
    from = rawFrom;
    to = rawTo;
  } else if (input.when === "range") {
    return { ok: false, error: "Période invalide." };
  }

  return {
    ok: true,
    query: {
      when: input.when,
      search: input.search,
      category,
      audience,
      city,
      cursor,
      limit,
      from,
      to,
    },
  };
}
