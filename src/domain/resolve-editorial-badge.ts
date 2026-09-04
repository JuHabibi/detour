/**
 * Pastille éditoriale « Faites un détour » — une seule, priorité fixe.
 * likelyDemand reste interne au ranking IA — ne produit plus de badge UI.
 */

export const EDITORIAL_BADGE_THRESHOLD = 3;
export const EDITORIAL_BADGE_CONFIDENCE_THRESHOLD = 0.7;
/** Pépite : missRisk strict (échelle 0–5). */
export const EDITORIAL_PEPITE_MISS_RISK_THRESHOLD = 4;

export type EditorialBadge =
  | "À réserver"
  | "À anticiper"
  | "Passage rare"
  | "Pépite locale";

export type EditorialBadgeInput = {
  planningNeed?: number | null;
  localRarity?: number | null;
  missRisk?: number | null;
  confidence?: number | null;
  /** Reasons IA de l’assessment (texte libre). */
  reasons?: string[] | null;
  /** registrationUrl présent sur l’événement. */
  hasRegistrationUrl: boolean;
};

/**
 * Priorité :
 * 1. planningNeed élevé + réservation → À réserver
 * 2. Passage rare (localRarity + confidence + reason rareté locale)
 * 3. planningNeed élevé → À anticiper
 * 4. Pépite locale (missRisk strict + confidence + reason miss/visibilité)
 * sinon aucune pastille.
 */
export function resolveEditorialBadge(
  input: EditorialBadgeInput,
): EditorialBadge | null {
  const threshold = EDITORIAL_BADGE_THRESHOLD;
  const planningNeed = toScore(input.planningNeed);
  const localRarity = toScore(input.localRarity);
  const missRisk = toScore(input.missRisk);
  const confidence = toScore(input.confidence);

  if (planningNeed >= threshold && input.hasRegistrationUrl) {
    return "À réserver";
  }
  if (qualifiesAsPassageRare(localRarity, confidence, input.reasons)) {
    return "Passage rare";
  }
  if (planningNeed >= threshold) {
    return "À anticiper";
  }
  if (qualifiesAsPepiteLocale(missRisk, confidence, input.reasons)) {
    return "Pépite locale";
  }
  return null;
}

export function qualifiesAsPassageRare(
  localRarity: number,
  confidence: number,
  reasons: string[] | null | undefined,
): boolean {
  if (localRarity < EDITORIAL_BADGE_THRESHOLD) return false;
  if (confidence < EDITORIAL_BADGE_CONFIDENCE_THRESHOLD) return false;
  return hasExplicitLocalRarityReason(reasons);
}

export function qualifiesAsPepiteLocale(
  missRisk: number,
  confidence: number,
  reasons: string[] | null | undefined,
): boolean {
  if (missRisk < EDITORIAL_PEPITE_MISS_RISK_THRESHOLD) return false;
  if (confidence < EDITORIAL_BADGE_CONFIDENCE_THRESHOLD) return false;
  return hasExplicitPepiteReason(reasons);
}

/**
 * Preuve textuelle de rareté locale du passage (présence / programmation).
 * La rareté de format artistique seule ne suffit pas.
 */
export function hasExplicitLocalRarityReason(
  reasons: string[] | null | undefined,
): boolean {
  if (!reasons || reasons.length === 0) return false;

  return reasons.some((reason) => {
    const normalized = normalizeReason(reason);
    if (!normalized) return false;
    if (isGenericNonProofReason(normalized)) return false;
    if (isArtisticFormatRarityClaim(normalized)) return false;
    return LOCAL_RARITY_REASON_PATTERNS.some((pattern) => pattern.test(normalized));
  });
}

/** Preuve textuelle de faible visibilité / facile à rater. */
export function hasExplicitPepiteReason(
  reasons: string[] | null | undefined,
): boolean {
  return reasonsMatch(reasons, PEPITE_REASON_PATTERNS);
}

function reasonsMatch(
  reasons: string[] | null | undefined,
  patterns: RegExp[],
): boolean {
  if (!reasons || reasons.length === 0) return false;

  return reasons.some((reason) => {
    const normalized = normalizeReason(reason);
    if (!normalized) return false;
    if (isGenericNonProofReason(normalized)) return false;
    return patterns.some((pattern) => pattern.test(normalized));
  });
}

/**
 * Preuves de rareté de présence / programmation locale — pas de rareté de format artistique.
 */
const LOCAL_RARITY_REASON_PATTERNS: RegExp[] = [
  /passage inhabituel/,
  /passage d (?:une|un) (?:artiste|compagnie|groupe|spectacle|comedien|humoriste)/,
  /inhabituel (?:dans|sur|pour) (?:cette|ce|cet|la|le|un|une )?(?:commune|lieu|territoire|region|ville|cadre)/,
  /peu habituel (?:dans|sur|pour) (?:cette|ce|cet|la|le|un|une )?(?:commune|lieu|territoire|region|ville|cadre)/,
  /artiste rarement/,
  /rarement programm/,
  /peu programm\w* localement/,
  /evenement rarement programm/,
  /presence exceptionnelle/,
  /exceptionnell?\w* (?:dans|sur|pour) (?:ce|cet|cette|le|la )?(?:lieu|territoire|commune|region|ville)/,
  /rar(?:e|ete)\w* (?:locale|localement)/,
  /rarete .{0,60}(?:commune|lieu|territoire|region|contexte|local)/,
  /rare (?:dans|sur) (?:cette|ce|cet|la|le|une) (?:commune|lieu|territoire|ville|region|contexte)/,
  /artiste (?:reconnu|connu).{0,50}(?:petite commune|commune|lieu local|cadre local)/,
  /(?:reconnu|connu).{0,40}(?:petite commune|dans une petite|cadre local)/,
];

const PEPITE_REASON_PATTERNS: RegExp[] = [
  /faible visibilite/,
  /visibilite .{0,30}faible/,
  /peu visible/,
  /peu mediatis/,
  /peu relay/,
  /facile(?:ment)? a rater/,
  /passer sous le radar/,
  /sous le radar/,
  /passer inapercu/,
  /decouverte locale/,
  /programmation (?:locale )?peu (?:visible|relay|mediatis)/,
  /circuit (?:local )?peu (?:visible|mediatis)/,
  /evenement (?:local )?peu (?:visible|mediatis|relay)/,
];

/** Reasons génériques qui ne prouvent ni rareté ni pépite. */
function isGenericNonProofReason(normalized: string): boolean {
  if (
    normalized === "singular" ||
    normalized === "local-discovery" ||
    normalized === "local discovery" ||
    normalized === "billetterie" ||
    normalized === "booking" ||
    normalized === "reservation"
  ) {
    return true;
  }

  if (
    /^(petite )?commune$/.test(normalized) ||
    /^(spectacle|concert|exposition|expo|humour)$/.test(normalized)
  ) {
    return true;
  }
  return false;
}

/** Rareté de format artistique ≠ rareté de présence / programmation locale. */
function isArtisticFormatRarityClaim(normalized: string): boolean {
  if (
    /format (?:rare|peu courant|original|inhabituel|atypique)/.test(normalized)
  ) {
    return true;
  }
  if (
    /(?:concert|spectacle|evenement).{0,40}format (?:rare|peu courant|original)/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/peu courant/.test(normalized)) {
    return true;
  }
  // « moins/peu fréquenté » sans preuve de programmation / passage local.
  if (
    /(?:moins|peu) frequen/.test(normalized) &&
    !/(?:programm|passage|presence|artiste rarement)/.test(normalized)
  ) {
    return true;
  }
  return false;
}

function normalizeReason(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
}
