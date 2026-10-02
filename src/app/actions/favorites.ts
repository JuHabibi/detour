"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { EventItem } from "@/data/types";
import {
  addFavorite as insertFavorite,
  listFavoriteEventIdsForUser,
  listFavoriteEventsForUser,
  removeFavorite as deleteFavorite,
} from "@/infrastructure/db/favorite.repository";

export type FavoriteActionResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "invalid" | "error" };

export type RemoveFavoriteActionResult =
  | FavoriteActionResult
  | { ok: false; reason: "confirmation_required" };

export type ListMyFavoriteEventIdsResult =
  | { ok: true; eventIds: string[] }
  | { ok: false; reason: "unauthenticated" | "error" };

export type ListMyFavoriteEventsResult =
  | { ok: true; events: EventItem[] }
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
 * Favoris complets (EventItem) pour mon parcours culturel.
 * Inclut les favoris hors carnet — les carnets ne sont pas un prérequis.
 */
export async function listMyFavoriteEvents(): Promise<ListMyFavoriteEventsResult> {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const rows = await listFavoriteEventsForUser(auth.user.id);
    return {
      ok: true,
      events: rows.map(mapDetourEventToEventItem),
    };
  } catch (error) {
    console.error("[detour:favorites] listMyFavoriteEvents failed", error);
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
 * Le premier appel demande confirmation si l'événement est dans un carnet.
 * Le second appel confirmé retire les appartenances et le favori en transaction.
 */
export async function removeFavorite(
  eventId: string,
  confirmCarnetRemoval = false,
): Promise<RemoveFavoriteActionResult> {
  const id = normalizeEventId(eventId);
  if (!id) return { ok: false, reason: "invalid" };

  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const outcome = await deleteFavorite(
      auth.user.id,
      id,
      confirmCarnetRemoval === true,
    );
    if (outcome === "confirmation_required") {
      return { ok: false, reason: "confirmation_required" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[detour:favorites] removeFavorite failed", error);
    return { ok: false, reason: "error" };
  }
}
