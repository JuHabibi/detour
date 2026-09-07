/**
 * Normalisation titres Mapado ↔ OpenAgenda (matching conservateur).
 */

const SEASON_SUFFIX =
  /\s+saison culturelle(?:\s+\d+\s*\/?\s*\d+)?(?:\s*\+.*)?$/i;

export function normalizeMapadoMatchText(value: string | null | undefined): string {
  if (!value) return "";
  let text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // & et « et » équivalents avant suppression de la ponctuation
  text = text.replace(/&/g, " et ");
  text = text.toLowerCase();
  text = text.replace(/[^a-z0-9\s]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(SEASON_SUFFIX, "").trim();
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export function titlesMatchConservatively(
  left: string,
  right: string,
): boolean {
  const a = normalizeMapadoMatchText(left);
  const b = normalizeMapadoMatchText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}
