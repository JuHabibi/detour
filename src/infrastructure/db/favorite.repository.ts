import "server-only";

import type { DetourEvent } from "@/domain/events/event";
import {
  mapEventRowToDetourEvent,
  type EventRow,
} from "@/infrastructure/db/event-row.mapper";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";
import { homePerfLog, homePerfTimed } from "@/infrastructure/db/home-perf";

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

const FAVORITE_EVENT_SELECT = `
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
FROM favorites f
INNER JOIN events e ON e.id = f.event_id
WHERE f.user_id = $1
ORDER BY f.created_at DESC, e.id ASC
`.trim();

/** IDs favoris d’un user — pour hydrater les cœurs Home. */
export async function listFavoriteEventIdsForUser(
  userId: string,
  client?: DbQueryable,
): Promise<string[]> {
  const { value: result, ms } = await homePerfTimed(() =>
    db(client).query<{ event_id: string }>(
      `
SELECT event_id
FROM favorites
WHERE user_id = $1
ORDER BY created_at DESC, event_id ASC
`.trim(),
      [userId],
    ),
  );
  homePerfLog(`favorites=${ms}ms rows=${result.rows.length}`);
  return result.rows.map((row) => row.event_id);
}

/** Events favoris (JOIN) — pour `/account`. Scoppé par user_id. */
export async function listFavoriteEventsForUser(
  userId: string,
  client?: DbQueryable,
): Promise<DetourEvent[]> {
  const result = await db(client).query<EventRow>(FAVORITE_EVENT_SELECT, [
    userId,
  ]);
  return result.rows.map(mapEventRowToDetourEvent);
}

/** Insert idempotent — double clic / retry sans doublon. */
export async function addFavorite(
  userId: string,
  eventId: string,
  client?: DbQueryable,
): Promise<void> {
  await db(client).query(
    `
INSERT INTO favorites (user_id, event_id)
VALUES ($1, $2)
ON CONFLICT (user_id, event_id) DO NOTHING
`.trim(),
    [userId, eventId],
  );
}

/**
 * Supprime uniquement si ownership (user_id + event_id).
 * @returns true si une ligne a été supprimée.
 */
export async function removeFavorite(
  userId: string,
  eventId: string,
  client?: DbQueryable,
): Promise<boolean> {
  const result = await db(client).query(
    `
DELETE FROM favorites
WHERE user_id = $1
  AND event_id = $2
`.trim(),
    [userId, eventId],
  );
  return (result.rowCount ?? 0) > 0;
}
