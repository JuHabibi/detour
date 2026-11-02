/** Chemin public d’une fiche événement (id encodé, stable hors titre). */
export function eventPublicPath(eventId: string): string {
  const trimmed = eventId.trim();
  return `/evenements/${encodeURIComponent(trimmed)}`;
}

/** Décode le segment dynamique Next — null si vide / mal formé. */
export function normalizeEventIdParam(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const trimmed = decoded.trim();
  return trimmed.length > 0 ? trimmed : null;
}
