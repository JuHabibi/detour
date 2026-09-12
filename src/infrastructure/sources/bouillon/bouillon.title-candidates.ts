/**
 * Heuristique simple : candidats artiste/œuvre depuis un titre Bouillon.
 * Pas de NLP — split explicite + titres entre guillemets.
 */
export function extractBouillonTitleCandidates(title: string): string[] {
  const trimmed = title.trim();
  if (!trimmed) return [];

  const segments = trimmed
    .split(/\s+\+\s+|\s+&\s+|\s+\/\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  for (const segment of segments) {
    const fromQuotes = extractQuotedWork(segment);
    if (fromQuotes) {
      pushUnique(candidates, fromQuotes);
      continue;
    }
    pushUnique(candidates, stripOuterQuotes(segment));
  }

  return candidates.filter((value) => value.length >= 2);
}

function extractQuotedWork(segment: string): string | null {
  const match =
    /^[«"“](.+?)[»"”](?:\s+d['’]|\s+de\s|\s+du\s|\s+des\s).*$/iu.exec(
      segment,
    ) ?? /^[«"“](.+?)[»"”]\s*$/u.exec(segment);
  if (!match) return null;
  return stripOuterQuotes(match[1]!).trim() || null;
}

function stripOuterQuotes(value: string): string {
  return value
    .replace(/^[«"“'\s]+/u, "")
    .replace(/[»"”'\s]+$/u, "")
    .trim();
}

function pushUnique(list: string[], value: string): void {
  const cleaned = value.trim();
  if (!cleaned) return;
  if (list.some((item) => normalizeCandidate(item) === normalizeCandidate(cleaned))) {
    return;
  }
  list.push(cleaned);
}

export function normalizeCandidate(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
