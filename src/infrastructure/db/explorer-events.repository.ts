import type { DetourEvent } from "@/domain/events/event";
import { attachAvailabilityToEvent } from "@/domain/events/attach-availability";
import type { EventAvailabilityRecord } from "@/domain/events/event-availability";
import {
  mapEventRowToDetourEvent,
  type EventRow,
} from "@/infrastructure/db/event-row.mapper";
import {
  buildExplorerCountSql,
  buildExplorerFilterSql,
  buildExplorerPageSql,
  type ExplorerKeysetAfter,
  type ExplorerResolvedFilters,
} from "@/infrastructure/db/explorer-events.sql";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";

export type {
  ExplorerKeysetAfter,
  ExplorerResolvedFilters,
  ExplorerTemporalFilter,
} from "@/infrastructure/db/explorer-events.sql";

type EventRowWithAvailability = EventRow & {
  availability_status: string | null;
  availability_provider: string | null;
  availability_provider_event_url: string | null;
  availability_checked_at: Date | null;
  city_key?: string | null;
  product_category?: string | null;
};

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

function toAvailabilityRecord(
  row: EventRowWithAvailability,
): EventAvailabilityRecord | null {
  if (!row.availability_status || !row.availability_checked_at) {
    return null;
  }
  return {
    eventId: row.id,
    status: row.availability_status as EventAvailabilityRecord["status"],
    provider: row.availability_provider ?? "",
    providerEventUrl: row.availability_provider_event_url,
    checkedAt: row.availability_checked_at,
  };
}

function mapRow(row: EventRowWithAvailability, now: Date): DetourEvent {
  const event = mapEventRowToDetourEvent(row);
  return attachAvailabilityToEvent(event, toAvailabilityRecord(row), now);
}

/** Compte les GROUPES filtrés — pas les rows brutes. */
export async function countExplorerEvents(params: {
  filters: ExplorerResolvedFilters;
  client?: DbQueryable;
}): Promise<number> {
  const { whereSql, params: filterParams } = buildExplorerFilterSql(
    params.filters,
  );
  const result = await db(params.client).query<{ count: string }>(
    buildExplorerCountSql(whereSql),
    filterParams,
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Page Explorer keyset sur representatives (start_at, id).
 * Cursor appliqué après grouping ; lit `limit + 1`.
 */
export async function listExplorerEventsPage(params: {
  filters: ExplorerResolvedFilters;
  after?: ExplorerKeysetAfter | null;
  limit: number;
  client?: DbQueryable;
  now?: Date;
}): Promise<{
  events: DetourEvent[];
  nextAfter: ExplorerKeysetAfter | null;
}> {
  const mapNow = params.now ?? new Date();
  const fetchLimit = params.limit + 1;
  const { whereSql, params: filterParams } = buildExplorerFilterSql(
    params.filters,
  );
  const sqlParams = [...filterParams];

  let keysetSql = "";
  const after = params.after ?? null;
  if (after) {
    sqlParams.push(after.startAt.toISOString());
    const startIdx = sqlParams.length;
    sqlParams.push(after.id);
    const idIdx = sqlParams.length;
    keysetSql = `
WHERE (
  start_at > $${startIdx}
  OR (start_at = $${startIdx} AND id > $${idIdx})
)`;
  }

  sqlParams.push(fetchLimit);
  const limitIdx = sqlParams.length;

  const result = await db(params.client).query<EventRowWithAvailability>(
    buildExplorerPageSql({ whereSql, keysetSql, limitIdx }),
    sqlParams,
  );

  const rows = result.rows;
  const hasMore = rows.length > params.limit;
  const pageRows = hasMore ? rows.slice(0, params.limit) : rows;
  const events = pageRows.map((row) => mapRow(row, mapNow));

  const last = pageRows[pageRows.length - 1];
  const nextAfter =
    hasMore && last ? { startAt: last.start_at, id: last.id } : null;

  return { events, nextAfter };
}
