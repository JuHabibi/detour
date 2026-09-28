/**
 * Valide une cible de redirection post-auth (anti open-redirect).
 * Accepte uniquement un chemin relatif interne commençant par `/`.
 */

/** Base fictive — sert uniquement à comparer l’origine après `new URL(...)`. */
const INTERNAL_REDIRECT_BASE = "https://detour.internal";

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function safeAccountNextPath(
  raw: string | string[] | undefined | null,
  fallback = "/account",
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  if (CONTROL_CHARS.test(trimmed)) return fallback;

  try {
    const resolved = new URL(trimmed, INTERNAL_REDIRECT_BASE);
    if (resolved.origin !== new URL(INTERNAL_REDIRECT_BASE).origin) {
      return fallback;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function accountLoginHref(next?: string | null): string {
  if (!next) return "/account/login";
  const safe = safeAccountNextPath(next, "");
  if (!safe) return "/account/login";
  return `/account/login?next=${encodeURIComponent(safe)}`;
}

export function accountSignupHref(next?: string | null): string {
  if (!next) return "/account/signup";
  const safe = safeAccountNextPath(next, "");
  if (!safe) return "/account/signup";
  return `/account/signup?next=${encodeURIComponent(safe)}`;
}
