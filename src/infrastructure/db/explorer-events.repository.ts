import type { DetourEvent } from "@/domain/events/event";
import { attachAvailabilityToEvent } from "@/domain/events/attach-availability";
import type { EventAvailabilityRecord } from "@/infrastructure/db/event-availability.repository";
import {
  mapEventRowToDetourEvent,
  type EventRow,
} from "@/infrastructure/db/event-row.mapper";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";

const EXPLORER_SELECT = `
SELECT
  e.id,
  e.adapter_id,
  e.title,
  e.description,
  e.image_url,
  e.start_at,
  e.end_at,
  e.venue,
  e.city,
  e.latitude,
  e.longitude,
  e.category,
  e.genre,
  e.conditions,
  e.source,
  e.source_url,
  e.registration_url,
  e.is_active,
  e.created_at,
  e.updated_at,
  e.last_seen_at,
  a.status AS availability_status,
  a.provider AS availability_provider,
  a.provider_event_url AS availability_provider_event_url,
  a.checked_at AS availability_checked_at
FROM events e
LEFT JOIN event_availability a ON a.event_id = e.id
`.trim();

type EventRowWithAvailability = EventRow & {
  availability_status: string | null;
  availability_provider: string | null;
  availability_provider_event_url: string | null;
  availability_checked_at: Date | null;
};

export type ExplorerKeysetAfter = {
  startAt: Date;
  id: string;
};

/** Bornes temporelles déjà résolues (application/domain) — pas de calendrier en SQL. */
export type ExplorerTemporalFilter =
  | { mode: "bounded"; from: Date; to: Date }
  | { mode: "upcoming"; now: Date };

export type ExplorerResolvedFilters = {
  temporal: ExplorerTemporalFilter;
  /** Pattern ILIKE (`%…%`) ou null = pas de filtre search. */
  searchPattern: string | null;
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

/**
 * Construit le WHERE partagé COUNT + page (sans cursor).
 * Predicats when = sémantique `isEventInWhenFilter`.
 */
export function buildExplorerFilterSql(filters: ExplorerResolvedFilters): {
  whereSql: string;
  params: unknown[];
} {
  const params: unknown[] = [];
  const parts: string[] = ["e.is_active = true"];

  if (filters.temporal.mode === "bounded") {
    params.push(filters.temporal.from.toISOString());
    const fromIdx = params.length;
    params.push(filters.temporal.to.toISOString());
    const toIdx = params.length;
    // Intersection d’intervalles (multi-jours inclus).
    parts.push(`e.start_at <= $${toIdx}`);
    parts.push(`COALESCE(e.end_at, e.start_at) >= $${fromIdx}`);
  } else {
    params.push(filters.temporal.now.toISOString());
    const nowIdx = params.length;
    parts.push(`COALESCE(e.end_at, e.start_at) >= $${nowIdx}`);
  }

  if (filters.searchPattern) {
    params.push(filters.searchPattern);
    const searchIdx = params.length;
    parts.push(`(
      e.title ILIKE $${searchIdx} ESCAPE '\\'
      OR COALESCE(e.venue, '') ILIKE $${searchIdx} ESCAPE '\\'
      OR COALESCE(e.description, '') ILIKE $${searchIdx} ESCAPE '\\'
    )`);
  }

  return {
    whereSql: parts.join("\n  AND "),
    params,
  };
}

/** Compte les événements filtrés — même WHERE que la page, sans cursor. */
export async function countExplorerEvents(params: {
  filters: ExplorerResolvedFilters;
  client?: DbQueryable;
}): Promise<number> {
  const { whereSql, params: filterParams } = buildExplorerFilterSql(
    params.filters,
  );
  const result = await db(params.client).query<{ count: string }>(
    `
SELECT count(*)::text AS count
FROM events e
WHERE ${whereSql}
`.trim(),
    filterParams,
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Page Explorer keyset sur (start_at, id).
 * Cursor appliqué après les filtres ; lit `limit + 1`.
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
  let where = whereSql;

  const after = params.after ?? null;
  if (after) {
    sqlParams.push(after.startAt.toISOString());
    const startIdx = sqlParams.length;
    sqlParams.push(after.id);
    const idIdx = sqlParams.length;
    where += `
  AND (
    e.start_at > $${startIdx}
    OR (e.start_at = $${startIdx} AND e.id > $${idIdx})
  )`;
  }

  sqlParams.push(fetchLimit);
  const limitIdx = sqlParams.length;

  const result = await db(params.client).query<EventRowWithAvailability>(
    `
${EXPLORER_SELECT}
WHERE ${where}
ORDER BY e.start_at ASC, e.id ASC
LIMIT $${limitIdx}
`.trim(),
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
