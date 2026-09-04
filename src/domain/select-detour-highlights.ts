import type { DetourEvent } from "@/domain/event";

export type HighlightReason =
  | "high-appeal"
  | "local-discovery"
  | "singular"
  | "booking-available";

export type EventHighlight = {
  event: DetourEvent;
  score: number;
  reasons: HighlightReason[];
};

export const HIGHLIGHT_WEIGHTS: Record<HighlightReason, number> = {
  "high-appeal": 3,
  "local-discovery": 3,
  singular: 2,
  "booking-available": 1,
};

const DEFAULT_LIMIT = 4;

const CULTURAL_RELEVANCE = new Set(["culture", "culture_leisure"]);

/** Formes culturelles fortes — attractivité (pas célébrité). */
const STRONG_CULTURE_CUES = [
  "spectacle",
  "concert",
  "theatre",
  "musique",
  "cinema",
  "projection",
  "festival",
  "opera",
  "orchestre",
  "danse",
] as const;

/** Formes singulières / ponctuelles. */
const SINGULAR_CUES = [
  "concert",
  "spectacle",
  "projection",
  "cinema",
  "festival",
  "exposition",
  "expo",
  "conference",
  "rencontre",
  "lecture",
] as const;

/** Petites structures / circuits locaux moins visibles. */
const LOCAL_STRUCTURE_CUES = [
  "mediatheque",
  "bibliotheque",
  "musee",
  "mjc",
  "maison de la culture",
  "centre culturel",
  "salle municipale",
  "mairie",
  "espace culturel",
  "conservatoire",
] as const;

/**
 * Sélection éditoriale « Faites un détour ».
 * Corpus : culture / culture_leisure uniquement.
 * Score = somme des poids des reasons retenues.
 */
export function selectDetourHighlights(
  events: DetourEvent[],
  options?: { limit?: number },
): EventHighlight[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  if (limit <= 0) return [];

  const scored = events
    .map(scoreEvent)
    .filter((highlight): highlight is EventHighlight => highlight != null)
    .sort(compareHighlights);

  return pickDiverse(scored, limit);
}

function scoreEvent(event: DetourEvent): EventHighlight | null {
  if (!isCulturalCandidate(event)) return null;

  const reasons: HighlightReason[] = [];

  if (hasHighAppeal(event)) reasons.push("high-appeal");
  if (hasLocalDiscovery(event)) reasons.push("local-discovery");
  if (hasSingular(event)) reasons.push("singular");
  if (event.registrationUrl) reasons.push("booking-available");

  if (reasons.length === 0) return null;

  return {
    event,
    reasons,
    score: reasons.reduce((sum, reason) => sum + HIGHLIGHT_WEIGHTS[reason], 0),
  };
}

function isCulturalCandidate(event: DetourEvent): boolean {
  return Boolean(event.relevance && CULTURAL_RELEVANCE.has(event.relevance));
}

function hasHighAppeal(event: DetourEvent): boolean {
  // Forme culturelle forte obligatoire — évite un score « appeal »
  // juste parce qu’un atelier a un lien de réservation.
  if (!hasAnyCue(buildCultureText(event), STRONG_CULTURE_CUES)) {
    return false;
  }

  let support = 0;
  if (isPunctual(event)) support += 1;
  if (event.registrationUrl) support += 1;
  if (hasRichDescription(event)) support += 1;
  if (hasStructuredSource(event)) support += 1;

  return support >= 1;
}

function hasLocalDiscovery(event: DetourEvent): boolean {
  const localText = normalize(
    [event.venue, event.source, event.title, event.description]
      .filter(Boolean)
      .join(" "),
  );
  const localStructure = hasAnyCue(localText, LOCAL_STRUCTURE_CUES);
  const otherCity = isOutsideOrleans(event.city);

  return localStructure || otherCity;
}

function hasSingular(event: DetourEvent): boolean {
  return hasAnyCue(buildCultureText(event), SINGULAR_CUES);
}

function isPunctual(event: DetourEvent): boolean {
  if (!event.endAt) return true;

  const start = Date.parse(event.startAt);
  const end = Date.parse(event.endAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return true;

  const durationMs = end - start;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return durationMs <= threeDaysMs;
}

function hasRichDescription(event: DetourEvent): boolean {
  const description = event.description?.trim() ?? "";
  return description.length >= 80;
}

function hasStructuredSource(event: DetourEvent): boolean {
  return Boolean(event.source?.trim() || event.sourceUrl?.trim());
}

function isOutsideOrleans(city: string | null): boolean {
  const normalized = normalize(city);
  if (!normalized) return false;
  return normalized !== "orleans";
}

function buildCultureText(event: DetourEvent): string {
  return normalize(
    [event.category, event.title, event.description, event.genre]
      .filter(Boolean)
      .join(" "),
  );
}

function hasAnyCue(text: string, cues: readonly string[]): boolean {
  return cues.some((cue) => {
    if (cue === "expo") {
      return /(^|[^a-z0-9])expo([^a-z0-9]|$)/.test(text);
    }
    return text.includes(cue);
  });
}

/**
 * Diversité V1 pour limit=4 :
 * 1. meilleur high-appeal
 * 2. meilleur local-discovery
 * 3. meilleur singular
 * 4. meilleur score restant
 * Fallback : meilleurs scores restants si une reason manque.
 */
function pickDiverse(
  ranked: EventHighlight[],
  limit: number,
): EventHighlight[] {
  const selected: EventHighlight[] = [];
  const selectedIds = new Set<string>();

  const slots: HighlightReason[] = [
    "high-appeal",
    "local-discovery",
    "singular",
  ];

  for (const reason of slots) {
    if (selected.length >= limit) break;
    const candidate = ranked.find(
      (item) =>
        !selectedIds.has(item.event.id) && item.reasons.includes(reason),
    );
    if (!candidate) continue;
    selected.push(candidate);
    selectedIds.add(candidate.event.id);
  }

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (selectedIds.has(item.event.id)) continue;
    selected.push(item);
    selectedIds.add(item.event.id);
  }

  return selected;
}

function compareHighlights(a: EventHighlight, b: EventHighlight): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.event.startAt.localeCompare(b.event.startAt);
}

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
