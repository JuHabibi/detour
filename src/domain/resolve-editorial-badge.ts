/**
 * Pastille éditoriale « Faites un détour » — une seule, priorité fixe.
 * Seuils dimensions 0–5 : « élevé » = ≥ 3.
 * Confidence 0–1 : « élevé » = ≥ 0.7.
 */

export const EDITORIAL_BADGE_THRESHOLD = 3;
export const EDITORIAL_BADGE_CONFIDENCE_THRESHOLD = 0.7;

export type EditorialBadge =
  | "À réserver"
  | "À anticiper"
  | "Passage rare"
  | "Fort potentiel"
  | "Pépite locale";

export type EditorialBadgeInput = {
  planningNeed?: number | null;
  localRarity?: number | null;
  likelyDemand?: number | null;
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
 * 2. Passage rare (localRarity + confidence + reason explicite)
 * 3. planningNeed élevé → À anticiper
 * 4. likelyDemand élevée → Fort potentiel
 * 5. missRisk élevé → Pépite locale
 * sinon aucune pastille.
 */
export function resolveEditorialBadge(
  input: EditorialBadgeInput,
): EditorialBadge | null {
  const threshold = EDITORIAL_BADGE_THRESHOLD;
  const planningNeed = toScore(input.planningNeed);
  const localRarity = toScore(input.localRarity);
  const likelyDemand = toScore(input.likelyDemand);
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
  if (likelyDemand >= threshold) {
    return "Fort potentiel";
  }
  if (missRisk >= threshold) {
    return "Pépite locale";
  }
  return null;
}

/** Exposé pour tests / debug. */
export function qualifiesAsPassageRare(
  localRarity: number,
  confidence: number,
  reasons: string[] | null | undefined,
): boolean {
  if (localRarity < EDITORIAL_BADGE_THRESHOLD) return false;
  if (confidence < EDITORIAL_BADGE_CONFIDENCE_THRESHOLD) return false;
  return hasExplicitLocalRarityReason(reasons);
}

/**
 * Preuve textuelle de rareté locale du passage.
 * Ignore les signaux génériques (singular, local-discovery, commune seule, format).
 */
export function hasExplicitLocalRarityReason(
  reasons: string[] | null | undefined,
): boolean {
  if (!reasons || reasons.length === 0) return false;

  return reasons.some((reason) => {
    const normalized = normalizeReason(reason);
    if (!normalized) return false;
    if (isGenericNonRarityReason(normalized)) return false;
    return LOCAL_RARITY_REASON_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  });
}

const LOCAL_RARITY_REASON_PATTERNS: RegExp[] = [
  /passage inhabituel/,
  /inhabituel (?:dans|sur) (?:cette|ce|cet) (?:commune|lieu|territoire|ville)/,
  /artiste rarement/,
  /rarement programm/,
  /peu programm\w* localement/,
  /presence exceptionnelle/,
  /exceptionnell?\w* (?:dans|sur) (?:cette|ce|cet) (?:commune|lieu|territoire|ville)/,
  /rar(?:e|ete)\w* (?:locale|localement)/,
  /rare (?:dans|sur) (?:cette|ce|cet) (?:commune|lieu|territoire|ville)/,
];

/** Reasons / tokens qui ne prouvent pas la rareté du passage. */
function isGenericNonRarityReason(normalized: string): boolean {
  if (
    normalized === "singular" ||
    normalized === "local-discovery" ||
    normalized === "local discovery" ||
    normalized === "billetterie" ||
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
