import type { PoolClient } from "pg";
import type { DetourEvent } from "@/domain/events/event";
import { attachAvailabilityToEvent } from "@/domain/events/attach-availability";
import type { EventAvailabilityRecord } from "@/domain/events/event-availability";
import {
  buildUpsertEventsChunkSql,
  detourEventToUpsertValues,
  mapEventRowToEventWithAdapter,
  type EventRow,
  type EventWithAdapter,
} from "@/infrastructure/db/event-row.mapper";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";

/** Taille de chunk upsert — même client pour tous les chunks. */
export const EVENT_UPSERT_CHUNK_SIZE = 150;

const LIST_UPCOMING_SQL = `
SELECT
  e.id,
  e.adapter_id,
  e.title,
  e.description,
  e.image_url,
  e.start_at,
  e.end_at,
  e.all_day,
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
WHERE e.is_active = true
  AND e.start_at < $2
  AND COALESCE(e.end_at, e.start_at) >= $1
ORDER BY e.start_at ASC, e.id ASC
`.trim();

type EventRowWithAvailability = EventRow & {
  availability_status: string | null;
  availability_provider: string | null;
  availability_provider_event_url: string | null;
  availability_checked_at: Date | null;
};

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

export async function listUpcomingActiveWithAdapter(params: {
  from: Date;
  to: Date;
  client?: DbQueryable;
  now?: Date;
}): Promise<EventWithAdapter[]> {
  const now = params.now ?? new Date();
  const result = await db(params.client).query<EventRowWithAvailability>(
    LIST_UPCOMING_SQL,
    [params.from.toISOString(), params.to.toISOString()],
  );

  return result.rows.map((row) => {
    const base = mapEventRowToEventWithAdapter(row);
    const record = toAvailabilityRecord(row);
    return {
      adapterId: base.adapterId,
      event: attachAvailabilityToEvent(base.event, record, now),
    };
  });
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

export async function listUpcomingActive(params: {
  from: Date;
  to: Date;
  client?: DbQueryable;
  now?: Date;
}): Promise<DetourEvent[]> {
  const rows = await listUpcomingActiveWithAdapter(params);
  return rows.map((row) => row.event);
}

export async function countActiveByAdapter(
  adapterId: string,
  client?: DbQueryable,
): Promise<number> {
  const result = await db(client).query<{ count: string }>(
    `
SELECT count(*)::text AS count
FROM events
WHERE adapter_id = $1
  AND is_active = true
`.trim(),
    [adapterId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Upsert par chunks sur le client fourni (transaction gérée par l’appelant).
 * Placeholders dynamiques uniquement ; valeurs métier en paramètres.
 */
export async function upsertMany(
  adapterId: string,
  events: DetourEvent[],
  syncMarker: Date,
  client: PoolClient,
): Promise<void> {
  if (events.length === 0) return;

  for (let offset = 0; offset < events.length; offset += EVENT_UPSERT_CHUNK_SIZE) {
    const chunk = events.slice(offset, offset + EVENT_UPSERT_CHUNK_SIZE);
    const sql = buildUpsertEventsChunkSql(chunk.length);
    const values: unknown[] = [];
    for (const event of chunk) {
      values.push(...detourEventToUpsertValues(adapterId, event, syncMarker));
    }
    await client.query(sql, values);
  }
}

/** Soft-disable les events de l’adapter non vus dans ce sync (même client / tx). */
export async function deactivateNotSeenSince(
  adapterId: string,
  syncMarker: Date,
  client: PoolClient,
): Promise<number> {
  const result = await client.query(
    `
UPDATE events
SET is_active = false,
    updated_at = now()
WHERE adapter_id = $1
  AND is_active = true
  AND last_seen_at < $2
`.trim(),
    [adapterId, syncMarker.toISOString()],
  );
  return result.rowCount ?? 0;
}
