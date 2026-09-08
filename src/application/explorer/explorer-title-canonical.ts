/**
 * Canonicalisation Explorer V1 — déterministe, conservative.
 * Doit rester alignée avec les expressions SQL du read model.
 */

const BLOCKED_EDITORIAL_PREFIX =
  /^(atelier|visites?|concert|exposition|expo|spectacle|conference|rencontre|projection)(\s|$)/;

/** Lowercase + trim + suppression des accents (NFD). */
export function foldExplorerText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Lieu normalisé — chaîne vide si absent (pas de regroupement sur venue vide). */
export function normalizeExplorerVenue(
  venue: string | null | undefined,
): string {
  if (!venue) return "";
  return foldExplorerText(venue)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Titre canonique V1 :
 * 1. fold
 * 2. strip année terminale
 * 3. strip préfixe éditorial court avant `:` / `-` (garde-fous)
 * 4. ponctuation → espaces
 */
export function canonicalizeExplorerTitle(title: string): string {
  let text = foldExplorerText(title);
  text = text.replace(/\s+(19|20)\d{2}\s*$/u, "").replace(/\s+/g, " ").trim();

  const stripped = stripShortEditorialPrefix(text);
  return foldExplorerText(stripped)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripShortEditorialPrefix(text: string): string {
  const match = text.match(/^(.{1,30}?)\s*[-–—:]\s+(.+)$/u);
  if (!match) return text;

  const prefix = match[1]!.trim();
  const suffix = match[2]!.trim();
  const prefixWords = prefix.split(/\s+/).filter(Boolean);
  const suffixCore = foldExplorerText(suffix)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const prefixCore = foldExplorerText(prefix)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (prefixWords.length < 1 || prefixWords.length > 3) return text;
  if (prefix.length > 30) return text;
  if (suffixCore.length < 8) return text;
  if (BLOCKED_EDITORIAL_PREFIX.test(prefixCore)) return text;

  return suffix;
}

/** Clé de partition stable — id si venue/titre vides (pas de collapse). */
export function explorerDedupePartitionKey(parts: {
  id: string;
  cityKey: string | null | undefined;
  venue: string | null | undefined;
  startAt: string | Date;
  endAt: string | Date | null | undefined;
  title: string;
}): {
  cityKey: string;
  venueKey: string;
  startAt: string;
  endEff: string;
  canonicalTitle: string;
} {
  const venueNorm = normalizeExplorerVenue(parts.venue);
  const canonicalTitle = canonicalizeExplorerTitle(parts.title);
  const startAt =
    parts.startAt instanceof Date
      ? parts.startAt.toISOString()
      : parts.startAt;
  const endRaw = parts.endAt ?? parts.startAt;
  const endEff =
    endRaw instanceof Date ? endRaw.toISOString() : String(endRaw);

  return {
    cityKey: parts.cityKey?.trim() || "",
    venueKey: venueNorm || parts.id,
    startAt,
    endEff,
    canonicalTitle: canonicalTitle || parts.id,
  };
}
