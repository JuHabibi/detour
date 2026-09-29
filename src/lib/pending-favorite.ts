/**
 * Intention « ajouter ce favori après auth ».
 * Portée dans l’URL (`addFavorite`) + sessionStorage (survit à une confirmation e-mail).
 * Pas de liste anonyme — un seul eventId à la fois.
 */

import { safeAccountNextPath } from "@/lib/safe-account-next-path";

export const ADD_FAVORITE_PARAM = "addFavorite";

export const PENDING_FAVORITE_STORAGE_KEY = "detour:pending-favorite:v1";

const INTERNAL_BASE = "https://detour.internal";

export type PendingFavoriteIntent = {
  v: 1;
  eventId: string;
  returnPath: string;
  updatedAt: string;
};

export function normalizePendingEventId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  return trimmed;
}

/** Construit un chemin de retour interne avec `?addFavorite=`. */
export function pathWithPendingFavorite(
  eventId: string,
  basePath = "/",
): string {
  const id = normalizePendingEventId(eventId);
  const safeBase = safeAccountNextPath(basePath, "/");
  if (!id) return safeBase;

  try {
    const url = new URL(safeBase, INTERNAL_BASE);
    url.searchParams.set(ADD_FAVORITE_PARAM, id);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `/?${ADD_FAVORITE_PARAM}=${encodeURIComponent(id)}`;
  }
}

export function extractPendingFavoriteIdFromPath(
  path: string,
): string | null {
  const safe = safeAccountNextPath(path, "");
  if (!safe) return null;
  try {
    const url = new URL(safe, INTERNAL_BASE);
    return normalizePendingEventId(url.searchParams.get(ADD_FAVORITE_PARAM));
  } catch {
    return null;
  }
}

/** Retire `addFavorite` en conservant le reste du chemin. */
export function stripPendingFavoriteFromPath(path: string): string {
  const safe = safeAccountNextPath(path, "/");
  try {
    const url = new URL(safe, INTERNAL_BASE);
    url.searchParams.delete(ADD_FAVORITE_PARAM);
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  } catch {
    return safe;
  }
}

export function readPendingFavoriteFromSearchParams(
  params: URLSearchParams | { get(name: string): string | null },
): string | null {
  return normalizePendingEventId(params.get(ADD_FAVORITE_PARAM));
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof globalThis.sessionStorage === "undefined") return null;
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function parsePendingFavoriteIntent(
  raw: unknown,
): PendingFavoriteIntent | null {
  if (raw == null || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  const eventId = normalizePendingEventId(record.eventId);
  if (!eventId) return null;
  const returnPath = safeAccountNextPath(
    typeof record.returnPath === "string" ? record.returnPath : "/",
    "/",
  );
  return {
    v: 1,
    eventId,
    returnPath,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

/** Persiste l’intention pour survivre à une confirmation e-mail (même navigateur). */
export function savePendingFavoriteIntent(
  eventId: string,
  returnPath = "/",
): boolean {
  const id = normalizePendingEventId(eventId);
  if (!id) return false;
  const storage = getSessionStorage();
  if (!storage) return false;
  const intent: PendingFavoriteIntent = {
    v: 1,
    eventId: id,
    returnPath: pathWithPendingFavorite(id, returnPath),
    updatedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(PENDING_FAVORITE_STORAGE_KEY, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}

export function readPendingFavoriteIntent(): PendingFavoriteIntent | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_FAVORITE_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    return parsePendingFavoriteIntent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearPendingFavoriteIntent(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(PENDING_FAVORITE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Résout l’eventId à ajouter : query URL prioritaire, sinon sessionStorage.
 */
export function resolvePendingFavoriteEventId(
  searchParams?: URLSearchParams | { get(name: string): string | null } | null,
): string | null {
  if (searchParams) {
    const fromUrl = readPendingFavoriteFromSearchParams(searchParams);
    if (fromUrl) return fromUrl;
  }
  return readPendingFavoriteIntent()?.eventId ?? null;
}
