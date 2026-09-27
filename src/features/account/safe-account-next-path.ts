/**
 * Valide une cible de redirection post-auth (anti open-redirect).
 * Accepte uniquement un chemin relatif interne commençant par `/`.
 */
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
  return trimmed;
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
