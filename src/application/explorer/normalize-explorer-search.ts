import { EXPLORER_SEARCH_MAX_LENGTH } from "@/application/explorer/types";

/**
 * Normalise la recherche Explorer V1.
 * Retourne null si aucun filtre (absent / vide après trim).
 * Pattern ILIKE déjà wrappé `%…%`, wildcards utilisateur échappés.
 */
export function normalizeExplorerSearch(
  search: string | null | undefined,
): string | null {
  if (search == null) return null;
  const trimmed = search.trim();
  if (!trimmed) return null;
  const clipped = trimmed.slice(0, EXPLORER_SEARCH_MAX_LENGTH);
  const escaped = clipped
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}
