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

export type GroupRow = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/** Liste Mon compte — compteurs + plage dates (events liés). */
export type GroupSummary = GroupRow & {
  eventCount: number;
  earliestStartAt: string | null;
  latestStartAt: string | null;
};

export type GroupWithEvents = GroupRow & {
  events: DetourEvent[];
};

export type AddEventToGroupResult =
  | { status: "added" }
  | { status: "already_member" }
  | { status: "not_found" };

/** Résultat bulk — doublons ignorés, events absents comptés (pas d’échec FK). */
export type AddEventsToGroupResult =
  | { status: "not_found" }
  | { status: "invalid" }
  | {
      status: "ok";
      addedCount: number;
      alreadyMemberCount: number;
      missingCount: number;
    };

export type CreateGroupWithEventsResult =
  | { status: "invalid" }
  | { status: "event_not_found" }
  | {
      status: "ok";
      group: GroupRow;
      addedCount: number;
      alreadyMemberCount: number;
      missingCount: number;
    };

/** Déduplique / trim une liste d’event ids — ordre stable de première occurrence. */
export function normalizeEventIds(eventIds: unknown): string[] {
  if (!Array.isArray(eventIds)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of eventIds) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

type GroupSqlRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

function mapGroupRow(row: GroupSqlRow): GroupRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}


/** Longueur max alignée sur l’input UI (`maxLength={80}`). */
export const MAX_GROUP_NAME_LENGTH = 80;

export function normalizeGroupName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) return null;
  return trimmed;
}

export async function createGroupForUser(
  userId: string,
  name: string,
  client?: DbQueryable,
): Promise<GroupRow | null> {
  const normalized = normalizeGroupName(name);
  if (!normalized) return null;

  const result = await db(client).query<GroupSqlRow>(
    `
INSERT INTO groups (user_id, name)
VALUES ($1, $2)
RETURNING id, user_id, name, created_at, updated_at
`.trim(),
    [userId, normalized],
  );
  const row = result.rows[0];
  return row ? mapGroupRow(row) : null;
}

export async function listGroupsForUser(
  userId: string,
  client?: DbQueryable,
): Promise<GroupRow[]> {
  const result = await db(client).query<GroupSqlRow>(
    `
SELECT id, user_id, name, created_at, updated_at
FROM groups
WHERE user_id = $1
ORDER BY created_at DESC, id ASC
`.trim(),
    [userId],
  );
  return result.rows.map(mapGroupRow);
}

type GroupSummarySqlRow = GroupSqlRow & {
  event_count: string | number;
  earliest_start_at: Date | null;
  latest_start_at: Date | null;
};

/** Groupes + eventCount / plage start_at — scoppé user_id. */
export async function listGroupSummariesForUser(
  userId: string,
  client?: DbQueryable,
): Promise<GroupSummary[]> {
  const result = await db(client).query<GroupSummarySqlRow>(
    `
SELECT
  g.id,
  g.user_id,
  g.name,
  g.created_at,
  g.updated_at,
  COUNT(ge.event_id)::int AS event_count,
  MIN(e.start_at) AS earliest_start_at,
  MAX(e.start_at) AS latest_start_at
FROM groups g
LEFT JOIN group_events ge ON ge.group_id = g.id
LEFT JOIN events e ON e.id = ge.event_id
WHERE g.user_id = $1
GROUP BY g.id
ORDER BY g.created_at DESC, g.id ASC
`.trim(),
    [userId],
  );

  return result.rows.map((row) => ({
    ...mapGroupRow(row),
    eventCount: Number(row.event_count),
    earliestStartAt: row.earliest_start_at
      ? row.earliest_start_at.toISOString()
      : null,
    latestStartAt: row.latest_start_at
      ? row.latest_start_at.toISOString()
      : null,
  }));
}

/**
 * Groupe + events — null si absent ou non owned (anti-IDOR).
 */
export async function getGroupWithEventsForUser(
  userId: string,
  groupId: string,
  client?: DbQueryable,
): Promise<GroupWithEvents | null> {
  const groupResult = await db(client).query<GroupSqlRow>(
    `
SELECT id, user_id, name, created_at, updated_at
FROM groups
WHERE id = $1
  AND user_id = $2
`.trim(),
    [groupId, userId],
  );
  const group = groupResult.rows[0];
  if (!group) return null;

  const eventsResult = await db(client).query<EventRow>(
    `
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
FROM group_events ge
INNER JOIN events e ON e.id = ge.event_id
WHERE ge.group_id = $1
ORDER BY ge.created_at DESC, e.id ASC
`.trim(),
    [groupId],
  );

  return {
    ...mapGroupRow(group),
    events: eventsResult.rows.map(mapEventRowToDetourEvent),
  };
}

/**
 * Rename scoppé ownership — null si groupe absent / autre user.
 */
export async function renameGroupForUser(
  userId: string,
  groupId: string,
  name: string,
  client?: DbQueryable,
): Promise<GroupRow | null> {
  const normalized = normalizeGroupName(name);
  if (!normalized) return null;

  const result = await db(client).query<GroupSqlRow>(
    `
UPDATE groups
SET name = $3,
    updated_at = now()
WHERE id = $1
  AND user_id = $2
RETURNING id, user_id, name, created_at, updated_at
`.trim(),
    [groupId, userId, normalized],
  );
  const row = result.rows[0];
  return row ? mapGroupRow(row) : null;
}

export async function deleteGroupForUser(
  userId: string,
  groupId: string,
  client?: DbQueryable,
): Promise<boolean> {
  const result = await db(client).query(
    `
DELETE FROM groups
WHERE id = $1
  AND user_id = $2
`.trim(),
    [groupId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addEventToGroupForUser(
  userId: string,
  groupId: string,
  eventId: string,
  client?: DbQueryable,
): Promise<AddEventToGroupResult> {
  const trimmedEventId = eventId.trim();
  if (!trimmedEventId) return { status: "not_found" };

  const result = await db(client).query<{ owned: boolean; inserted: boolean }>(
    `
WITH owned AS (
  SELECT id
  FROM groups
  WHERE id = $1
    AND user_id = $2
),
ins AS (
  INSERT INTO group_events (group_id, event_id)
  SELECT id, $3
  FROM owned
  ON CONFLICT (group_id, event_id) DO NOTHING
  RETURNING group_id
)
SELECT
  EXISTS (SELECT 1 FROM owned) AS owned,
  EXISTS (SELECT 1 FROM ins) AS inserted
`.trim(),
    [groupId, userId, trimmedEventId],
  );

  const row = result.rows[0];
  if (!row?.owned) return { status: "not_found" };
  return row.inserted ? { status: "added" } : { status: "already_member" };
}

/**
 * Ajout multiple en une requête — ownership via CTE, ON CONFLICT ignore doublons,
 * events absents exclus via JOIN (pas d’erreur FK).
 */
export async function addEventsToGroupForUser(
  userId: string,
  groupId: string,
  eventIds: string[],
  client?: DbQueryable,
): Promise<AddEventsToGroupResult> {
  const ids = normalizeEventIds(eventIds);
  if (ids.length === 0) return { status: "invalid" };

  const result = await db(client).query<{
    owned: boolean;
    added_count: string | number;
    already_member_count: string | number;
    missing_count: string | number;
  }>(
    `
WITH wanted AS (
  SELECT DISTINCT unnest($3::text[]) AS event_id
),
owned AS (
  SELECT id
  FROM groups
  WHERE id = $1
    AND user_id = $2
),
existing AS (
  SELECT w.event_id
  FROM wanted w
  INNER JOIN events e ON e.id = w.event_id
),
missing AS (
  SELECT w.event_id
  FROM wanted w
  WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = w.event_id)
),
ins AS (
  INSERT INTO group_events (group_id, event_id)
  SELECT o.id, ex.event_id
  FROM owned o
  CROSS JOIN existing ex
  ON CONFLICT (group_id, event_id) DO NOTHING
  RETURNING event_id
)
SELECT
  EXISTS (SELECT 1 FROM owned) AS owned,
  (SELECT COUNT(*)::int FROM ins) AS added_count,
  (
    (SELECT COUNT(*)::int FROM existing)
    - (SELECT COUNT(*)::int FROM ins)
  ) AS already_member_count,
  (SELECT COUNT(*)::int FROM missing) AS missing_count
`.trim(),
    [groupId, userId, ids],
  );

  const row = result.rows[0];
  if (!row?.owned) return { status: "not_found" };

  return {
    status: "ok",
    addedCount: Number(row.added_count),
    alreadyMemberCount: Number(row.already_member_count),
    missingCount: Number(row.missing_count),
  };
}

/**
 * Crée un groupe et y ajoute des events dans une transaction.
 * Si tous les eventIds sont absents → ROLLBACK (pas de groupe vide accidentel).
 */
export async function createGroupWithEventsForUser(params: {
  userId: string;
  name: string;
  eventIds: string[];
}): Promise<CreateGroupWithEventsResult> {
  const normalized = normalizeGroupName(params.name);
  if (!normalized) return { status: "invalid" };

  const ids = normalizeEventIds(params.eventIds);

  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const group = await createGroupForUser(params.userId, normalized, client);
      if (!group) {
        await client.query("ROLLBACK");
        return { status: "invalid" };
      }

      if (ids.length === 0) {
        await client.query("COMMIT");
        return {
          status: "ok",
          group,
          addedCount: 0,
          alreadyMemberCount: 0,
          missingCount: 0,
        };
      }

      const add = await addEventsToGroupForUser(
        params.userId,
        group.id,
        ids,
        client,
      );
      if (add.status !== "ok") {
        await client.query("ROLLBACK");
        return { status: "invalid" };
      }

      // Aucun event valide → rollback pour ne pas laisser un groupe vide.
      if (add.addedCount === 0 && add.missingCount > 0) {
        await client.query("ROLLBACK");
        return { status: "event_not_found" };
      }

      await client.query("COMMIT");
      return {
        status: "ok",
        group,
        addedCount: add.addedCount,
        alreadyMemberCount: add.alreadyMemberCount,
        missingCount: add.missingCount,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function removeEventFromGroupForUser(
  userId: string,
  groupId: string,
  eventId: string,
  client?: DbQueryable,
): Promise<boolean> {
  const result = await db(client).query(
    `
DELETE FROM group_events ge
USING groups g
WHERE ge.group_id = g.id
  AND g.id = $1
  AND g.user_id = $2
  AND ge.event_id = $3
`.trim(),
    [groupId, userId, eventId.trim()],
  );
  return (result.rowCount ?? 0) > 0;
}
