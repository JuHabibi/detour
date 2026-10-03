import "server-only";

/**
 * Memberships carnets : apply (validation) et create+apply (création),
 * chacun dans une seule transaction (favoris + appartenances).
 */
import { addFavorite } from "@/infrastructure/db/favorite.repository";
import {
  addEventsToGroupForUser,
  createGroupForUser,
  normalizeEventIds,
  type GroupRow,
} from "@/infrastructure/db/group.repository";
import {
  withClient,
  type DbQueryable,
} from "@/infrastructure/db/postgres";

export type ApplyEventCarnetMembershipsResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "event_not_found" };

export type ApplyEventCarnetMembershipsParams = {
  userId: string;
  eventIds: string[];
  /** Carnets auxquels ajouter les événements. */
  addGroupIds: string[];
  /** Carnets dont retirer les événements. */
  removeGroupIds: string[];
  /** Connexion dédiée (tests PGlite) — sinon `withClient`. */
  client?: DbQueryable;
};

export type CreateGroupWithEventCarnetMembershipsParams = {
  userId: string;
  name: string;
  eventIds: string[];
  /** Carnets existants auxquels ajouter les événements. */
  addGroupIds: string[];
  /** Carnets existants dont retirer les événements. */
  removeGroupIds: string[];
  client?: DbQueryable;
};

export type CreateGroupWithEventCarnetMembershipsResult =
  | { status: "ok"; group: GroupRow }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "event_not_found" }
  | { status: "limit_reached" };

function normalizeGroupIds(groupIds: unknown): string[] {
  if (!Array.isArray(groupIds)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of groupIds) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Favoris + ajouts/retraits sur une connexion déjà en transaction. */
async function applyMembershipsOnConnection(
  client: DbQueryable,
  params: {
    userId: string;
    eventIds: string[];
    addGroupIds: string[];
    removeGroupIds: string[];
  },
): Promise<ApplyEventCarnetMembershipsResult> {
  const eventIds = normalizeEventIds(params.eventIds);
  const addGroupIds = normalizeGroupIds(params.addGroupIds);
  const removeGroupIds = normalizeGroupIds(params.removeGroupIds);

  if (eventIds.length === 0) return { status: "invalid" };

  const addSet = new Set(addGroupIds);
  for (const groupId of removeGroupIds) {
    if (addSet.has(groupId)) return { status: "invalid" };
  }

  const allGroupIds = [...new Set([...addGroupIds, ...removeGroupIds])];

  const eventsCheck = await client.query<{ n: string }>(
    `
SELECT COUNT(*)::text AS n
FROM events
WHERE id = ANY($1::text[])
`.trim(),
    [eventIds],
  );
  if (Number(eventsCheck.rows[0]?.n ?? 0) !== eventIds.length) {
    return { status: "event_not_found" };
  }

  if (allGroupIds.length > 0) {
    const groupsCheck = await client.query<{ n: string }>(
      `
SELECT COUNT(*)::text AS n
FROM groups
WHERE user_id = $1
  AND id = ANY($2::uuid[])
`.trim(),
      [params.userId, allGroupIds],
    );
    if (Number(groupsCheck.rows[0]?.n ?? 0) !== allGroupIds.length) {
      return { status: "not_found" };
    }
  }

  for (const eventId of eventIds) {
    await addFavorite(params.userId, eventId, client);
  }

  for (const groupId of addGroupIds) {
    const add = await addEventsToGroupForUser(
      params.userId,
      groupId,
      eventIds,
      client,
    );
    if (add.status === "not_found") return { status: "not_found" };
    if (add.status === "invalid") return { status: "invalid" };
    if (add.missingCount > 0) return { status: "event_not_found" };
  }

  if (removeGroupIds.length > 0) {
    // Idempotent : 0 ligne supprimée = déjà retiré, pas une erreur.
    await client.query(
      `
DELETE FROM group_events ge
USING groups g
WHERE ge.group_id = g.id
  AND g.user_id = $1
  AND g.id = ANY($2::uuid[])
  AND ge.event_id = ANY($3::text[])
`.trim(),
      [params.userId, removeGroupIds, eventIds],
    );
  }

  return { status: "ok" };
}

async function runInTransaction<T extends { status: string }>(
  client: DbQueryable | undefined,
  run: (c: DbQueryable) => Promise<T>,
): Promise<T> {
  const exec = async (c: DbQueryable) => {
    await c.query("BEGIN");
    try {
      const result = await run(c);
      if (result.status !== "ok") {
        await c.query("ROLLBACK");
        return result;
      }
      await c.query("COMMIT");
      return result;
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    }
  };

  if (client) return exec(client);
  return withClient(exec);
}

/**
 * Vérifie ownership + events, assure les favoris, applique ajouts/retraits.
 * Commit uniquement si tout réussit — sinon rollback intégral.
 */
export async function applyEventCarnetMembershipsForUser(
  params: ApplyEventCarnetMembershipsParams,
): Promise<ApplyEventCarnetMembershipsResult> {
  const { client: injected, ...body } = params;
  return runInTransaction(injected, (client) =>
    applyMembershipsOnConnection(client, body),
  );
}

/**
 * Crée un carnet puis applique favoris + memberships (nouveau + existants)
 * dans la même transaction. N’appelle pas `createGroupWithEventsForUser`
 * (qui ouvrirait sa propre transaction).
 */
export async function createGroupWithEventCarnetMembershipsForUser(
  params: CreateGroupWithEventCarnetMembershipsParams,
): Promise<CreateGroupWithEventCarnetMembershipsResult> {
  const { client: injected, ...body } = params;

  return runInTransaction(injected, async (client) => {
    const created = await createGroupForUser(body.userId, body.name, client);
    if (created.status === "limit_reached") {
      return { status: "limit_reached" };
    }
    if (created.status !== "ok") {
      return { status: "invalid" };
    }

    const apply = await applyMembershipsOnConnection(client, {
      userId: body.userId,
      eventIds: body.eventIds,
      addGroupIds: [created.group.id, ...body.addGroupIds],
      removeGroupIds: body.removeGroupIds,
    });
    if (apply.status !== "ok") {
      return apply;
    }

    return { status: "ok", group: created.group };
  });
}
