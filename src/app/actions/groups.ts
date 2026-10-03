"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  addEventToGroupForUser,
  addEventsToGroupForUser,
  createGroupForUser,
  createGroupWithEventsForUser,
  deleteGroupForUser,
  getGroupWithEventsForUser,
  listEventGroupMembershipsForUser,
  listGroupSummariesForUser,
  normalizeEventIds,
  removeEventFromGroupForUser,
  renameGroupForUser,
  type EventGroupMembership,
  type GroupRow,
  type GroupSummary,
} from "@/application/groups";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { EventItem } from "@/data/types";
import {
  applyEventCarnetMembershipsForUser,
  createGroupWithEventCarnetMembershipsForUser,
} from "@/infrastructure/db/carnet-memberships.repository";

export type ListMyCarnetsStateResult =
  | {
      ok: true;
      groups: GroupSummary[];
      memberships: EventGroupMembership[];
    }
  | { ok: false; reason: "unauthenticated" | "error" };

/** Hydratation Home — carnets + memberships session (pas de userId client). */
export async function listMyCarnetsState(): Promise<ListMyCarnetsStateResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const [groups, memberships] = await Promise.all([
      listGroupSummariesForUser(userId),
      listEventGroupMembershipsForUser(userId),
    ]);
    return { ok: true, groups, memberships };
  } catch (error) {
    console.error("[detour:groups] listMyCarnetsState failed", error);
    return { ok: false, reason: "error" };
  }
}

export type GroupMutationResult =
  | { ok: true; group?: GroupRow }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "invalid"
        | "not_found"
        | "already_member"
        | "event_not_found"
        | "limit_reached"
        | "error";
    };

export type BulkGroupMutationResult =
  | {
      ok: true;
      addedCount: number;
      alreadyMemberCount: number;
      missingCount: number;
      group?: GroupRow;
    }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "invalid"
        | "not_found"
        | "event_not_found"
        | "limit_reached"
        | "error";
    };

function normalizeGroupId(groupId: unknown): string | null {
  if (typeof groupId !== "string") return null;
  const trimmed = groupId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEventId(eventId: unknown): string | null {
  if (typeof eventId !== "string") return null;
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23503"
  );
}

async function requireUserId(): Promise<string | null> {
  const auth = await getAccountAuthState();
  return auth.status === "authenticated" ? auth.user.id : null;
}

/** Crée un groupe pour la session — jamais de userId client. */
export async function createGroup(name: string): Promise<GroupMutationResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const result = await createGroupForUser(userId, name);
    if (result.status === "limit_reached") {
      return { ok: false, reason: "limit_reached" };
    }
    if (result.status !== "ok") return { ok: false, reason: "invalid" };
    return { ok: true, group: result.group };
  } catch (error) {
    console.error("[detour:groups] createGroup failed", error);
    return { ok: false, reason: "error" };
  }
}

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<GroupMutationResult> {
  const id = normalizeGroupId(groupId);
  if (!id) return { ok: false, reason: "invalid" };

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const group = await renameGroupForUser(userId, id, name);
    if (!group) return { ok: false, reason: "not_found" };
    return { ok: true, group };
  } catch (error) {
    console.error("[detour:groups] renameGroup failed", error);
    return { ok: false, reason: "error" };
  }
}

export async function deleteGroup(
  groupId: string,
): Promise<GroupMutationResult> {
  const id = normalizeGroupId(groupId);
  if (!id) return { ok: false, reason: "invalid" };

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const deleted = await deleteGroupForUser(userId, id);
    if (!deleted) return { ok: false, reason: "not_found" };
    return { ok: true };
  } catch (error) {
    console.error("[detour:groups] deleteGroup failed", error);
    return { ok: false, reason: "error" };
  }
}

export async function addFavoriteToGroup(
  groupId: string,
  eventId: string,
): Promise<GroupMutationResult> {
  const gId = normalizeGroupId(groupId);
  const eId = normalizeEventId(eventId);
  if (!gId || !eId) return { ok: false, reason: "invalid" };

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const result = await addEventToGroupForUser(userId, gId, eId);
    if (result.status === "not_found") return { ok: false, reason: "not_found" };
    if (result.status === "already_member") {
      return { ok: false, reason: "already_member" };
    }
    return { ok: true };
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      return { ok: false, reason: "event_not_found" };
    }
    console.error("[detour:groups] addFavoriteToGroup failed", error);
    return { ok: false, reason: "error" };
  }
}

/** Ajout multiple en une opération serveur — pas de boucle N actions client. */
export async function addFavoritesToGroup(
  groupId: string,
  eventIds: string[],
): Promise<BulkGroupMutationResult> {
  const gId = normalizeGroupId(groupId);
  const ids = normalizeEventIds(eventIds);
  if (!gId || ids.length === 0) return { ok: false, reason: "invalid" };

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const result = await addEventsToGroupForUser(userId, gId, ids);
    if (result.status === "not_found") return { ok: false, reason: "not_found" };
    if (result.status === "invalid") return { ok: false, reason: "invalid" };
    return {
      ok: true,
      addedCount: result.addedCount,
      alreadyMemberCount: result.alreadyMemberCount,
      missingCount: result.missingCount,
    };
  } catch (error) {
    console.error("[detour:groups] addFavoritesToGroup failed", error);
    return { ok: false, reason: "error" };
  }
}

/**
 * Crée un groupe + ajoute les events en transaction (session userId).
 * Évite le flow client create puis add séparé.
 */
export async function createGroupWithFavorites(
  name: string,
  eventIds: string[],
): Promise<BulkGroupMutationResult> {
  const ids = normalizeEventIds(eventIds);
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const result = await createGroupWithEventsForUser({
      userId,
      name,
      eventIds: ids,
    });
    if (result.status === "invalid") return { ok: false, reason: "invalid" };
    if (result.status === "limit_reached") {
      return { ok: false, reason: "limit_reached" };
    }
    if (result.status === "event_not_found") {
      return { ok: false, reason: "event_not_found" };
    }
    return {
      ok: true,
      group: result.group,
      addedCount: result.addedCount,
      alreadyMemberCount: result.alreadyMemberCount,
      missingCount: result.missingCount,
    };
  } catch (error) {
    console.error("[detour:groups] createGroupWithFavorites failed", error);
    return { ok: false, reason: "error" };
  }
}

export async function removeEventFromGroup(
  groupId: string,
  eventId: string,
): Promise<GroupMutationResult> {
  const gId = normalizeGroupId(groupId);
  const eId = normalizeEventId(eventId);
  if (!gId || !eId) return { ok: false, reason: "invalid" };

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const removed = await removeEventFromGroupForUser(userId, gId, eId);
    if (!removed) return { ok: false, reason: "not_found" };
    return { ok: true };
  } catch (error) {
    console.error("[detour:groups] removeEventFromGroup failed", error);
    return { ok: false, reason: "error" };
  }
}

export type ApplyEventCarnetMembershipsActionResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "invalid"
        | "not_found"
        | "event_not_found"
        | "error";
    };

/**
 * Enregistre des événements dans des carnets existants (ajouts + retraits explicites).
 * Session userId uniquement — une transaction serveur (favoris + memberships).
 * Ne crée pas de carnet (flow séparé).
 */
export async function applyEventCarnetMemberships(
  eventIds: string[],
  addGroupIds: string[],
  removeGroupIds: string[],
): Promise<ApplyEventCarnetMembershipsActionResult> {
  const ids = normalizeEventIds(eventIds);
  if (ids.length === 0) return { ok: false, reason: "invalid" };
  if (!Array.isArray(addGroupIds) || !Array.isArray(removeGroupIds)) {
    return { ok: false, reason: "invalid" };
  }

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const result = await applyEventCarnetMembershipsForUser({
      userId,
      eventIds: ids,
      addGroupIds,
      removeGroupIds,
    });
    if (result.status === "invalid") return { ok: false, reason: "invalid" };
    if (result.status === "not_found") return { ok: false, reason: "not_found" };
    if (result.status === "event_not_found") {
      return { ok: false, reason: "event_not_found" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[detour:groups] applyEventCarnetMemberships failed", error);
    return { ok: false, reason: "error" };
  }
}

export type CreateGroupWithEventCarnetMembershipsActionResult =
  | { ok: true; group: GroupRow }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "invalid"
        | "not_found"
        | "event_not_found"
        | "limit_reached"
        | "error";
    };

/**
 * Crée un carnet + favoris + memberships (nouveau et existants) en une transaction.
 * Session userId uniquement.
 */
export async function createGroupWithEventCarnetMemberships(
  name: string,
  eventIds: string[],
  addGroupIds: string[],
  removeGroupIds: string[],
): Promise<CreateGroupWithEventCarnetMembershipsActionResult> {
  const ids = normalizeEventIds(eventIds);
  if (ids.length === 0) return { ok: false, reason: "invalid" };
  if (!Array.isArray(addGroupIds) || !Array.isArray(removeGroupIds)) {
    return { ok: false, reason: "invalid" };
  }

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const result = await createGroupWithEventCarnetMembershipsForUser({
      userId,
      name,
      eventIds: ids,
      addGroupIds,
      removeGroupIds,
    });
    if (result.status === "limit_reached") {
      return { ok: false, reason: "limit_reached" };
    }
    if (result.status === "invalid") return { ok: false, reason: "invalid" };
    if (result.status === "not_found") return { ok: false, reason: "not_found" };
    if (result.status === "event_not_found") {
      return { ok: false, reason: "event_not_found" };
    }
    return { ok: true, group: result.group };
  } catch (error) {
    console.error(
      "[detour:groups] createGroupWithEventCarnetMemberships failed",
      error,
    );
    return { ok: false, reason: "error" };
  }
}

export type GetMyCarnetEventsResult =
  | {
      ok: true;
      group: { id: string; name: string };
      events: EventItem[];
    }
  | { ok: false; reason: "unauthenticated" | "invalid" | "not_found" | "error" };

/**
 * Events d’un carnet de la session — ownership SQL (anti-IDOR).
 * Carnet d’un autre user → not_found, jamais d’events.
 */
export async function getMyCarnetEvents(
  groupId: string,
): Promise<GetMyCarnetEventsResult> {
  const gId = normalizeGroupId(groupId);
  if (!gId) return { ok: false, reason: "invalid" };

  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try {
    const group = await getGroupWithEventsForUser(userId, gId);
    if (!group) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      group: { id: group.id, name: group.name },
      events: group.events.map(mapDetourEventToEventItem),
    };
  } catch (error) {
    console.error("[detour:groups] getMyCarnetEvents failed", error);
    return { ok: false, reason: "error" };
  }
}
