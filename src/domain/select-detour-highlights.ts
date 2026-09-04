import type { DetourEvent } from "@/domain/event";

export type HighlightReason =
  | "high-appeal"
  | "headline-appeal"
  | "local-discovery"
  | "singular"
  | "booking-available";

export type HighlightSlot =
  | "strong-event"
  | "local-gem"
  | "easy-to-miss"
  | "worth-planning"
  | "rare-local"
  | "wildcard";

export type HighlightSelectionSource = "ai" | "deterministic";

/** Méta debug quand la sélection vient des scores IA. */
export type AiHighlightSelectionMeta = {
  formula:
    | "strong"
    | "easy-to-miss"
    | "worth-planning"
    | "rare-local"
    | "wildcard";
  slotScore: number;
  appeal: number;
  missRisk: number;
  planningNeed: number;
  localRarity: number;
  likelyDemand: number;
  confidence: number;
  aiReasons: string[];
};

export type EventHighlight = {
  event: DetourEvent;
  score: number;
  /** Tie-break secondaire — anticipation, pas urgence. */
  planningScore: number;
  reasons: HighlightReason[];
  /** Renseigné uniquement après sélection éditoriale. */
  slot?: HighlightSlot;
  /** Origine de la sélection « Faites un détour ». */
  selectionSource?: HighlightSelectionSource;
  /** Scores IA utilisés pour le slot (debug). */
  aiSelection?: AiHighlightSelectionMeta;
};

export const HIGHLIGHT_WEIGHTS: Record<HighlightReason, number> = {
  "high-appeal": 2,
  "headline-appeal": 3,
  "local-discovery": 2,
  singular: 2,
  "booking-available": 1,
};

const DEFAULT_LIMIT = 10;

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
  "humour",
] as const;

/** Formes compatibles avec une tête d’affiche / artiste mis en avant. */
const HEADLINE_FORM_CUES = [
  "spectacle",
  "theatre",
  "concert",
  "danse",
  "humour",
  "conference",
  "rencontre",
  "projection",
  "cinema",
  "musique",
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

/** Mots fréquents capitalisés à ne pas prendre pour un prénom/nom. */
const PROPER_NAME_STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "de",
  "en",
  "au",
  "aux",
  "sur",
  "pour",
  "dans",
  "par",
  "avec",
  "chez",
  "sans",
  "sous",
  "theatre",
  "festival",
  "maison",
  "centre",
  "salle",
  "place",
  "rue",
  "avenue",
  "saint",
  "sainte",
  "ville",
  "espace",
  "jardin",
  "parc",
  "musee",
  "concert",
  "spectacle",
  "exposition",
  "atelier",
  "conference",
  "rencontre",
  "orleans",
  "metropole",
  "agenda",
  "sortie",
  "sorties",
]);

const PERSON_TOKEN = String.raw`[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’]+(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’]+)?`;
const PERSON_PAIR = `${PERSON_TOKEN}\\s+${PERSON_TOKEN}`;

const ATTRIBUTED_PERSON_PATTERNS = [
  new RegExp(`\\bavec\\s+${PERSON_PAIR}`, "u"),
  new RegExp(`\\bpar\\s+${PERSON_PAIR}`, "u"),
  new RegExp(`\\bde\\s+${PERSON_PAIR}`, "u"),
  new RegExp(`\\binterpr[ée]t[ée]\\s+par\\s+${PERSON_PAIR}`, "iu"),
  new RegExp(`\\bmise\\s+en\\s+sc[èe]ne\\s+par\\s+${PERSON_PAIR}`, "iu"),
  new RegExp(`\\bavec\\s+la\\s+participation\\s+de\\s+${PERSON_PAIR}`, "iu"),
];

const ENSEMBLE_PATTERNS_NORMALIZED = [
  /\bcompagnie\s+[a-z0-9][\w'-]*/u,
  /\bcie\.?\s+[a-z0-9][\w'-]*/u,
  /\bcollectif\s+[a-z0-9][\w'-]*/u,
  /\bduo\s+[a-z0-9][\w'-]*/u,
  /\btrio\s+[a-z0-9][\w'-]*/u,
  /\bartiste\s+[a-z0-9][\w'-]*/u,
] as const;

/**
 * Sélection éditoriale « Faites un détour ».
 * Corpus : culture / culture_leisure uniquement.
 * Score = somme des poids des reasons retenues.
 * Sélection finale = composition par slots éditoriaux.
 */
export function selectDetourHighlights(
  events: DetourEvent[],
  options?: { limit?: number; now?: Date },
): EventHighlight[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  if (limit <= 0) return [];

  const now = options?.now ?? new Date();
  return pickEditorialSlots(
    rankDetourHighlightCandidates(events, { now }),
    limit,
    now,
  );
}

/** Tous les candidats scorés, triés — utile pour le debug. */
export function rankDetourHighlightCandidates(
  events: DetourEvent[],
  options?: { now?: Date },
): EventHighlight[] {
  const now = options?.now ?? new Date();
  return events
    .map((event) => scoreEvent(event, now))
    .filter((highlight): highlight is EventHighlight => highlight != null)
    .sort(compareHighlights);
}

function scoreEvent(event: DetourEvent, now: Date): EventHighlight | null {
  if (!isCulturalCandidate(event)) return null;

  const reasons: HighlightReason[] = [];

  if (hasHighAppeal(event)) reasons.push("high-appeal");
  if (hasHeadlineAppeal(event)) reasons.push("headline-appeal");
  if (hasLocalDiscovery(event)) reasons.push("local-discovery");
  if (hasSingular(event)) reasons.push("singular");
  if (event.registrationUrl) reasons.push("booking-available");

  if (reasons.length === 0) return null;

  return {
    event,
    reasons,
    score: reasons.reduce((sum, reason) => sum + HIGHLIGHT_WEIGHTS[reason], 0),
    planningScore: computePlanningScore(reasons, event, now),
  };
}

/**
 * Valeur d’anticipation (interne).
 * Ne mesure pas l’urgence — départage seulement à score égal.
 */
function computePlanningScore(
  reasons: HighlightReason[],
  event: DetourEvent,
  now: Date,
): number {
  let planning = 0;
  const hasBooking = reasons.includes("booking-available");
  const hasHeadline = reasons.includes("headline-appeal");
  const hasHighAppealReason = reasons.includes("high-appeal");
  const hasSingularReason = reasons.includes("singular");

  if (hasHeadline && hasBooking) planning += 1;
  if (hasSingularReason && hasBooking) planning += 1;

  if (
    hasBooking &&
    (hasHeadline || hasHighAppealReason) &&
    startsInMoreThanDays(event.startAt, now, 30)
  ) {
    planning += 1;
  }

  return planning;
}

function startsInMoreThanDays(
  startAt: string,
  now: Date,
  days: number,
): boolean {
  const start = Date.parse(startAt);
  if (Number.isNaN(start)) return false;
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return start - now.getTime() > thresholdMs;
}

function isCulturalCandidate(event: DetourEvent): boolean {
  return Boolean(event.relevance && CULTURAL_RELEVANCE.has(event.relevance));
}

function hasHighAppeal(event: DetourEvent): boolean {
  if (!hasAnyCue(buildCultureText(event), STRONG_CULTURE_CUES)) {
    return false;
  }

  let support = 0;
  if (isPunctual(event)) support += 1;
  if (event.registrationUrl) support += 1;
  if (hasRichDescription(event)) support += 1;
  if (hasStructuredSource(event)) support += 1;

  return support >= 2;
}

function hasHeadlineAppeal(event: DetourEvent): boolean {
  const cultureText = buildCultureText(event);
  if (!hasAnyCue(cultureText, HEADLINE_FORM_CUES)) return false;

  const raw = [event.title, event.description].filter(Boolean).join(" ");
  if (!raw.trim()) return false;

  if (hasAttributedPerson(raw)) return true;
  if (hasEnsembleCue(normalize(raw))) return true;
  if (hasConservativeProperName(raw)) return true;

  return false;
}

function hasAttributedPerson(raw: string): boolean {
  return ATTRIBUTED_PERSON_PATTERNS.some((pattern) => {
    const match = raw.match(pattern);
    if (!match) return false;
    return extractPersonPair(match[0]) != null;
  });
}

function hasEnsembleCue(normalized: string): boolean {
  return ENSEMBLE_PATTERNS_NORMALIZED.some((pattern) => pattern.test(normalized));
}

/**
 * Paire capitalisée type « Prénom Nom », hors stopwords.
 * Conservateur : ignore les titres génériques (« Le Bourgeois … »).
 */
function hasConservativeProperName(raw: string): boolean {
  const pairPattern = new RegExp(PERSON_PAIR, "gu");
  for (const match of raw.matchAll(pairPattern)) {
    if (extractPersonPair(match[0])) return true;
  }
  return false;
}

function extractPersonPair(fragment: string): [string, string] | null {
  const tokens = fragment.match(new RegExp(PERSON_TOKEN, "gu"));
  if (!tokens || tokens.length < 2) return null;

  const first = tokens[tokens.length - 2];
  const second = tokens[tokens.length - 1];
  if (isNameStopword(first) || isNameStopword(second)) return null;
  return [first, second];
}

function isNameStopword(token: string): boolean {
  return PROPER_NAME_STOPWORDS.has(normalize(token.replace(/-/g, " ").split(" ")[0] ?? token));
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
 * Composition éditoriale :
 * A. strong-event ×2 (si limit ≥ 10 ; sinon ×1)
 * B. local-gem ×2 (si limit ≥ 6)
 * C. worth-planning ×2 (si limit ≥ 10 ; sinon ×1)
 * D. wildcard — compléter jusqu’à limit
 * Fallback : meilleur restant si un slot thématique est vide.
 */
function pickEditorialSlots(
  ranked: EventHighlight[],
  limit: number,
  now: Date,
): EventHighlight[] {
  const selected: EventHighlight[] = [];
  const selectedIds = new Set<string>();
  const strongTarget = limit >= 10 ? 2 : 1;
  const localGemTarget = limit >= 6 ? 2 : 1;
  const planningTarget = limit >= 10 ? 2 : 1;

  const available = () =>
    ranked.filter((item) => !selectedIds.has(item.event.id));

  const take = (candidate: EventHighlight | undefined, slot: HighlightSlot) => {
    if (!candidate || selected.length >= limit) return;
    if (selectedIds.has(candidate.event.id)) return;
    selected.push({ ...candidate, slot });
    selectedIds.add(candidate.event.id);
  };

  const takeBestRemaining = (slot: HighlightSlot) => {
    take(available()[0], slot);
  };

  // A. strong-event
  for (let i = 0; i < strongTarget && selected.length < limit; i += 1) {
    const headline = available()
      .filter((item) => item.reasons.includes("headline-appeal"))
      .sort(compareHighlights);
    const highAppeal = available()
      .filter((item) => item.reasons.includes("high-appeal"))
      .sort(compareHighlights);
    const strongPool = headline.length > 0 ? headline : highAppeal;
    const strongPick = pickBestDifferentProfile(strongPool, selected);
    if (strongPick) take(strongPick, "strong-event");
    else takeBestRemaining("wildcard");
  }

  // B. local-gem
  for (let i = 0; i < localGemTarget && selected.length < limit; i += 1) {
    const localPool = available()
      .filter((item) => item.reasons.includes("local-discovery"))
      .sort(compareHighlights);
    const localPick = pickBestDifferentProfile(localPool, selected);
    if (localPick) take(localPick, "local-gem");
    else takeBestRemaining("wildcard");
  }

  // C. worth-planning
  for (let i = 0; i < planningTarget && selected.length < limit; i += 1) {
    const planningPool = available()
      .filter(
        (item) =>
          item.planningScore > 0 &&
          item.reasons.includes("booking-available") &&
          startsInMoreThanDays(item.event.startAt, now, 30),
      )
      .sort(comparePlanningFirst);
    const planningPick = pickBestDifferentProfile(planningPool, selected);
    if (planningPick) take(planningPick, "worth-planning");
    else takeBestRemaining("wildcard");
  }

  // D. wildcard + compléments
  while (selected.length < limit) {
    const remaining = available().sort(compareHighlights);
    const wildPick = pickBestDifferentProfile(remaining, selected);
    if (!wildPick) break;
    take(wildPick, "wildcard");
  }

  return selected.slice(0, limit);
}

/** Préfère un profil de reasons différent des déjà sélectionnés. */
function pickBestDifferentProfile(
  candidates: EventHighlight[],
  selected: EventHighlight[],
): EventHighlight | undefined {
  if (candidates.length === 0) return undefined;
  if (selected.length === 0) return candidates[0];

  const selectedProfiles = new Set(selected.map(profileKey));
  const different = candidates.find(
    (item) => !selectedProfiles.has(profileKey(item)),
  );
  return different ?? candidates[0];
}

function profileKey(highlight: EventHighlight): string {
  return (["headline-appeal", "local-discovery", "singular"] as const)
    .filter((reason) => highlight.reasons.includes(reason))
    .join("+");
}

/** planningScore desc → score desc → date asc. */
function comparePlanningFirst(a: EventHighlight, b: EventHighlight): number {
  if (b.planningScore !== a.planningScore) {
    return b.planningScore - a.planningScore;
  }
  if (b.score !== a.score) return b.score - a.score;
  return a.event.startAt.localeCompare(b.event.startAt);
}

/** Score desc → planningScore desc → date de début asc. */
function compareHighlights(a: EventHighlight, b: EventHighlight): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.planningScore !== a.planningScore) {
    return b.planningScore - a.planningScore;
  }
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
