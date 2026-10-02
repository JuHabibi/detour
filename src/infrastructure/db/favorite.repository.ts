import "server-only";

import type { DetourEvent } from "@/domain/events/event";
import {
  mapEventRowToDetourEvent,
  type EventRow,
} from "@/infrastructure/db/event-row.mapper";
import {
  getPool,
  withClient,
  type DbQueryable,
} from "@/infrastructure/db/postgres";

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
  const result = await db(client).query<{ event_id: string }>(
    `
SELECT event_id
FROM favorites
WHERE user_id = $1
ORDER BY created_at DESC, event_id ASC
`.trim(),
    [userId],
  );
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
 * Retire le favori et ses appartenances aux carnets de l’utilisateur.
 * Une seule transaction sur la même connexion : group_events puis favorites.
 * Scoppé user_id (session) + event_id — anti-BOLA.
 * Renvoie confirmation_required sans modifier les données si un carnet existe.
 */
export async function removeFavorite(
  userId: string,
  eventId: string,
  confirmCarnetRemoval = false,
): Promise<"removed" | "confirmation_required"> {
  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      if (!confirmCarnetRemoval) {
        const memberships = await c.query<{ in_carnet: boolean }>(
        `
SELECT EXISTS (
  SELECT 1
  FROM group_events ge
  JOIN groups g ON g.id = ge.group_id
  WHERE g.user_id = $1
    AND ge.event_id = $2
) AS in_carnet
`.trim(),
          [userId, eventId],
        );
        if (memberships.rows[0]?.in_carnet) {
          await c.query("COMMIT");
          return "confirmation_required";
        }
      }

      await c.query(
        `
DELETE FROM group_events ge
USING groups g
WHERE ge.group_id = g.id
  AND g.user_id = $1
  AND ge.event_id = $2
`.trim(),
        [userId, eventId],
      );
      await c.query(
        `
DELETE FROM favorites
WHERE user_id = $1
  AND event_id = $2
`.trim(),
        [userId, eventId],
      );
      await c.query("COMMIT");
      return "removed";
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    }
  });
}
