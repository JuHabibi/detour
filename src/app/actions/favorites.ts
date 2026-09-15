"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  addFavorite as insertFavorite,
  listFavoriteEventIdsForUser,
  removeFavorite as deleteFavorite,
} from "@/infrastructure/db/favorite.repository";

export type FavoriteActionResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "invalid" | "error" };

export type ListMyFavoriteEventIdsResult =
  | { ok: true; eventIds: string[] }
  | { ok: false; reason: "unauthenticated" | "error" };

function normalizeEventId(eventId: unknown): string | null {
  if (typeof eventId !== "string") return null;
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Liste les IDs favoris de la session courante (hydratation Home post-paint).
 * Aucun userId client — scopé session serveur.
 */
export async function listMyFavoriteEventIds(): Promise<ListMyFavoriteEventIdsResult> {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const eventIds = await listFavoriteEventIdsForUser(auth.user.id);
    return { ok: true, eventIds };
  } catch (error) {
    console.error("[detour:favorites] listMyFavoriteEventIds failed", error);
    return { ok: false, reason: "error" };
  }
}

/**
 * Ajoute un favori pour l’utilisateur de la session courante.
 * Le client n’envoie que `eventId` — jamais de `userId`.
 */
export async function addFavorite(
  eventId: string,
): Promise<FavoriteActionResult> {
  const id = normalizeEventId(eventId);
  if (!id) return { ok: false, reason: "invalid" };

  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    await insertFavorite(auth.user.id, id);
    return { ok: true };
  } catch (error) {
    console.error("[detour:favorites] addFavorite failed", error);
    return { ok: false, reason: "error" };
  }
}

/**
 * Retire un favori pour l’utilisateur de la session courante.
 * DELETE scoppé user_id (session) + event_id — anti-BOLA.
 */
export async function removeFavorite(
  eventId: string,
): Promise<FavoriteActionResult> {
  const id = normalizeEventId(eventId);
  if (!id) return { ok: false, reason: "invalid" };

  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    await deleteFavorite(auth.user.id, id);
    return { ok: true };
  } catch (error) {
    console.error("[detour:favorites] removeFavorite failed", error);
    return { ok: false, reason: "error" };
  }
}
