import { selectedEventDatesCteSql, eventOccurrencesJsonSql, EVENT_OCCURRENCES_JSON_SQL, scheduleEndAfterSql } from "./event-schedule.sql";
import type { PoolClient } from "pg";
import type { DetourEvent } from "@/domain/events/event";
import { attachAvailabilityToEvent } from "@/domain/events/attach-availability";
import type { EventAvailabilityRecord } from "@/domain/events/event-availability";
import {
  buildUpsertEventsChunkSql,
  detourEventToUpsertValues,
  mapEventRowToDetourEvent,
  mapEventRowToEventWithAdapter,
  type EventRow,
  type EventWithAdapter,
} from "@/infrastructure/db/event-row.mapper";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";
import { replaceEventOccurrences } from "@/infrastructure/db/event-occurrence.repository";

/** Taille de chunk upsert — même client pour tous les chunks. */
export const EVENT_UPSERT_CHUNK_SIZE = 150;

const LIST_UPCOMING_SQL = `
WITH ${selectedEventDatesCteSql(`e.is_active = true AND s.start_at < $2 AND ${scheduleEndAfterSql("$1")}`)}
SELECT
  e.id,
  e.adapter_id,
  e.title,
  e.description,
  e.image_url,
  e.image_credit,
  e.image_license,
  e.image_source_url,
  s.start_at,
  s.end_at,
  e.start_at AS source_start_at,
  e.end_at AS source_end_at,
  s.all_day,
  ${eventOccurrencesJsonSql(`s.start_at < $2 AND ${scheduleEndAfterSql("$1")}`)} AS occurrences,
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
JOIN selected_event_dates s ON s.event_id = e.id
LEFT JOIN event_availability a ON a.event_id = e.id
WHERE e.is_active = true
ORDER BY s.start_at ASC, e.id ASC
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

const GET_EVENT_BY_ID_SQL = `
SELECT
  e.id,
  e.adapter_id,
  e.title,
  e.description,
  e.image_url,
  e.image_credit,
  e.image_license,
  e.image_source_url,
  e.start_at,
  e.end_at,
  e.all_day,
  ${EVENT_OCCURRENCES_JSON_SQL} AS occurrences,
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
  e.last_seen_at
FROM events e
WHERE e.id = $1
`.trim();

export type EventRecord = {
  event: DetourEvent;
  isActive: boolean;
};

/**
 * Lecture par id avec statut actif — null si absent.
 * Ne filtre pas `is_active` (la politique d’accès reste au use case).
 */
export async function getEventRecordById(
  eventId: string,
  client?: DbQueryable,
): Promise<EventRecord | null> {
  const trimmed = eventId.trim();
  if (!trimmed) return null;

  const result = await db(client).query<EventRow>(GET_EVENT_BY_ID_SQL, [
    trimmed,
  ]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    event: mapEventRowToDetourEvent(row),
    isActive: row.is_active,
  };
}

/** Lecture publique minimale par id — null si absent. */
export async function getEventById(
  eventId: string,
  client?: DbQueryable,
): Promise<DetourEvent | null> {
  const record = await getEventRecordById(eventId, client);
  return record?.event ?? null;
}

export type EventSitemapRow = {
  id: string;
  startAt: string;
  endAt: string | null;
  occurrences?: DetourEvent["occurrences"];
};

const LIST_ACTIVE_SITEMAP_SQL = `
SELECT e.id, e.start_at, e.end_at, ${EVENT_OCCURRENCES_JSON_SQL} AS occurrences
FROM events e
WHERE e.is_active = true
ORDER BY e.id ASC
`.trim();

/**
 * Corpus actif pour le sitemap — champs minimaux, pas de pagination Explorer.
 * Le filtre « non terminé » se fait après cache, à l’horloge de la requête.
 */
export async function listActiveEventsForSitemap(
  client?: DbQueryable,
): Promise<EventSitemapRow[]> {
  const result = await db(client).query<{
    id: string;
    start_at: Date;
    end_at: Date | null;
    occurrences?: DetourEvent["occurrences"] | null;
  }>(LIST_ACTIVE_SITEMAP_SQL);

  return result.rows.map((row) => ({
    id: row.id,
    startAt: row.start_at.toISOString(),
    endAt: row.end_at ? row.end_at.toISOString() : null,
    ...(row.occurrences != null ? { occurrences: row.occurrences } : {}),
  }));
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
    await replaceEventOccurrences(chunk, syncMarker, client);
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
