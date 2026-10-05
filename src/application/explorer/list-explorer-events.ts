import {
  decodeExplorerCursor,
  encodeExplorerCursor,
} from "@/application/explorer/explorer-cursor";
import { normalizeExplorerSearch } from "@/application/explorer/normalize-explorer-search";
import {
  EXPLORER_DEFAULT_PAGE_SIZE,
  EXPLORER_MAX_PAGE_SIZE,
  type ListExplorerEventsQuery,
  type ListExplorerEventsResult,
} from "@/application/explorer/types";
import {
  getDateRangeForParisDateKeys,
  getDateRangeForWhenFilter,
} from "@/domain/time/when-filter";
import {
  countExplorerEvents,
  listExplorerEventsPage,
  type ExplorerResolvedFilters,
  type ExplorerTemporalFilter,
} from "@/infrastructure/db/explorer-events.repository";
import type { DbQueryable } from "@/infrastructure/db/postgres";

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit) || limit < 1) {
    return EXPLORER_DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(limit), EXPLORER_MAX_PAGE_SIZE);
}

function resolveFilters(
  query: ListExplorerEventsQuery,
  now: Date,
): ExplorerResolvedFilters {
  let temporal: ExplorerTemporalFilter;

  if (query.from != null && query.to != null) {
    const window = getDateRangeForParisDateKeys(query.from, query.to);
    if (!window?.to) {
      // Déjà validé en parse — garde-fou défensif.
      temporal = { mode: "upcoming", now };
    } else {
      // Contrat frise : début dans la fenêtre + encore à venir (≠ overlap Explorer).
      temporal = {
        mode: "startInWindowUpcoming",
        from: window.from,
        to: window.to,
        now,
      };
    }
  } else {
    const range = getDateRangeForWhenFilter(query.when, now);
    temporal =
      range.to == null
        ? ({ mode: "upcoming", now } as const)
        : ({ mode: "bounded", from: range.from, to: range.to } as const);
  }

  return {
    temporal,
    searchPattern: normalizeExplorerSearch(query.search),
    productCategory: query.category ?? null,
    cityKey: query.city ?? null,
  };
}

/**
 * Liste Explorer paginée.
 * - Sans curseur : count (groupes dédupliqués) + page en parallèle.
 * - Avec curseur valide : page seule ; `totalCount` est `null`.
 */
export async function listExplorerEvents(
  query: ListExplorerEventsQuery,
  options?: { client?: DbQueryable; now?: Date },
): Promise<ListExplorerEventsResult> {
  const now = options?.now ?? new Date();
  const limit = clampLimit(query.limit);
  const filters = resolveFilters(query, now);

  // Décoder / valider le curseur avant toute requête SQL.
  const after = query.cursor
    ? (() => {
        const decoded = decodeExplorerCursor(query.cursor);
        return { startAt: new Date(decoded.startAt), id: decoded.id };
      })()
    : null;

  if (after) {
    const page = await listExplorerEventsPage({
      filters,
      after,
      limit,
      client: options?.client,
      now,
    });
    return {
      events: page.events,
      totalCount: null,
      nextCursor: page.nextAfter
        ? encodeExplorerCursor({
            startAt: page.nextAfter.startAt.toISOString(),
            id: page.nextAfter.id,
          })
        : null,
    };
  }

  const [totalCount, page] = await Promise.all([
    countExplorerEvents({
      filters,
      client: options?.client,
    }),
    listExplorerEventsPage({
      filters,
      after: null,
      limit,
      client: options?.client,
      now,
    }),
  ]);

  return {
    events: page.events,
    totalCount,
    nextCursor: page.nextAfter
      ? encodeExplorerCursor({
          startAt: page.nextAfter.startAt.toISOString(),
          id: page.nextAfter.id,
        })
      : null,
  };
}
