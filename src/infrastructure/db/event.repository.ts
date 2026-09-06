import type { PoolClient } from "pg";
import type { DetourEvent } from "@/domain/event";
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
  id,
  adapter_id,
  title,
  description,
  image_url,
  start_at,
  end_at,
  venue,
  city,
  latitude,
  longitude,
  category,
  genre,
  conditions,
  source,
  source_url,
  registration_url,
  is_active,
  created_at,
  updated_at,
  last_seen_at
FROM events
WHERE is_active = true
  AND start_at < $2
  AND COALESCE(end_at, start_at) >= $1
ORDER BY start_at ASC, id ASC
`.trim();

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

export async function listUpcomingActiveWithAdapter(params: {
  from: Date;
  to: Date;
  client?: DbQueryable;
}): Promise<EventWithAdapter[]> {
  const result = await db(params.client).query<EventRow>(LIST_UPCOMING_SQL, [
    params.from.toISOString(),
    params.to.toISOString(),
  ]);
  return result.rows.map(mapEventRowToEventWithAdapter);
}

export async function listUpcomingActive(params: {
  from: Date;
  to: Date;
  client?: DbQueryable;
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
