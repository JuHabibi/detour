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
import { getDateRangeForWhenFilter } from "@/domain/time/when-filter";
import {
  countExplorerEvents,
  listExplorerEventsPage,
  type ExplorerResolvedFilters,
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
  const range = getDateRangeForWhenFilter(query.when, now);
  const temporal =
    range.to == null
      ? ({ mode: "upcoming", now } as const)
      : ({ mode: "bounded", from: range.from, to: range.to } as const);

  return {
    temporal,
    searchPattern: normalizeExplorerSearch(query.search),
    productCategory: query.category ?? null,
    cityKey: query.city ?? null,
  };
}


export async function listExplorerEvents(
  query: ListExplorerEventsQuery,
  options?: { client?: DbQueryable; now?: Date },
): Promise<ListExplorerEventsResult> {
  const now = options?.now ?? new Date();
  const limit = clampLimit(query.limit);
  const filters = resolveFilters(query, now);

  const after = query.cursor
    ? (() => {
        const decoded = decodeExplorerCursor(query.cursor);
        return { startAt: new Date(decoded.startAt), id: decoded.id };
      })()
    : null;

  const [totalCount, page] = await Promise.all([
    countExplorerEvents({
      filters,
      client: options?.client,
    }),
    listExplorerEventsPage({
      filters,
      after,
      limit,
      client: options?.client,
      now,
    }),
  ]);

  const nextCursor = page.nextAfter
    ? encodeExplorerCursor({
        startAt: page.nextAfter.startAt.toISOString(),
        id: page.nextAfter.id,
      })
    : null;

  return {
    events: page.events,
    totalCount,
    nextCursor,
  };
}
