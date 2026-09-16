"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  addEventToGroupForUser,
  createGroupForUser,
  deleteGroupForUser,
  removeEventFromGroupForUser,
  renameGroupForUser,
  type GroupRow,
} from "@/application/groups";

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
    const group = await createGroupForUser(userId, name);
    if (!group) return { ok: false, reason: "invalid" };
    return { ok: true, group };
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
