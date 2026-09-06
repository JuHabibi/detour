import {
  combinedAiScore,
  type AiHighlightAssessment,
} from "@/domain/ai-highlight-assessment";
import type {
  AiHighlightSelectionMeta,
  EventHighlight,
  HighlightSlot,
} from "@/domain/editorial/select-detour-highlights";

export type AiSlotFormula = AiHighlightSelectionMeta["formula"];

/** Radar culturel local — jusqu’à 10 événements. */
export const AI_DETOUR_DEFAULT_LIMIT = 10;
/** Garde-fou diversité : max events même venue. */
export const AI_DETOUR_MAX_PER_VENUE = 2;
/** Garde-fou diversité : max events même ville. */
export const AI_DETOUR_MAX_PER_CITY = 3;
/** Tolérance de score pour remplacer un candidat saturant (points de slot). */
export const AI_DETOUR_DIVERSITY_SCORE_TOLERANCE = 2;

export type AssessedCandidate = {
  candidate: EventHighlight;
  assessment: AiHighlightAssessment;
  index: number;
};

/**
 * Séquence IA cible (limit ≥ 10) :
 * 2 strong, 2 easy-to-miss, 2 worth-planning, 2 rare-local, 2 wildcard.
 */
export function buildAiDetourSlotSequence(limit: number): HighlightSlot[] {
  if (limit <= 0) return [];

  const ideal: HighlightSlot[] = [
    "strong-event",
    "strong-event",
    "easy-to-miss",
    "easy-to-miss",
    "worth-planning",
    "worth-planning",
    "rare-local",
    "rare-local",
    "wildcard",
    "wildcard",
  ];

  if (limit >= ideal.length) {
    const slots = [...ideal];
    while (slots.length < limit) slots.push("wildcard");
    return slots;
  }

  if (limit >= 6) {
    const slots: HighlightSlot[] = [
      "strong-event",
      "easy-to-miss",
      "easy-to-miss",
      "worth-planning",
      "rare-local",
    ];
    while (slots.length < limit) slots.push("wildcard");
    return slots.slice(0, limit);
  }

  const compact: HighlightSlot[] = [
    "strong-event",
    "easy-to-miss",
    "worth-planning",
    "rare-local",
    "wildcard",
  ];
  return compact.slice(0, limit);
}

export function strongEventScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.appeal * 2 + assessment.likelyDemand * 2 + assessment.planningNeed
  );
}

export function easyToMissScore(assessment: AiHighlightAssessment): number {
  return assessment.missRisk * 2 + assessment.appeal + assessment.localRarity;
}

export function worthPlanningScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.planningNeed * 2 + assessment.likelyDemand + assessment.appeal
  );
}

export function rareLocalScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.localRarity * 2 + assessment.appeal + assessment.likelyDemand
  );
}

export function wildcardSlotScore(assessment: AiHighlightAssessment): number {
  return combinedAiScore(assessment);
}

export function meetsAiSlotFloor(
  slot: HighlightSlot,
  assessment: AiHighlightAssessment,
): boolean {
  switch (slot) {
    case "strong-event":
      return assessment.appeal >= 3 || assessment.likelyDemand >= 3;
    case "easy-to-miss":
      return assessment.missRisk >= 2;
    case "worth-planning":
      return assessment.planningNeed >= 2;
    case "rare-local":
      return assessment.localRarity >= 2;
    case "wildcard":
    case "local-gem":
      return true;
  }
}

export function scoreForHighlightSlot(
  slot: HighlightSlot | undefined,
  assessment: AiHighlightAssessment,
): number {
  const { scoreFn } = scoreConfigForSlot(slot ?? "wildcard");
  return scoreFn(assessment);
}

/**
 * Sélection éditoriale « Faites un détour » pilotée par l’IA.
 * Puis garde-fou diversité venue/ville (souple, tolérance de score).
 */
export function selectAiDetourHighlights(
  candidates: EventHighlight[],
  assessments: AiHighlightAssessment[],
  options?: { limit?: number },
): EventHighlight[] {
  const limit = options?.limit ?? AI_DETOUR_DEFAULT_LIMIT;
  if (limit <= 0 || assessments.length === 0 || candidates.length === 0) {
    return [];
  }

  const assessmentById = new Map(
    assessments.map((item) => [item.eventId, item] as const),
  );

  const pool: AssessedCandidate[] = candidates
    .map((candidate, index) => {
      const assessment = assessmentById.get(candidate.event.id);
      if (!assessment) return null;
      return { candidate, assessment, index };
    })
    .filter((item): item is AssessedCandidate => item != null);

  if (pool.length === 0) return [];

  const selected: EventHighlight[] = [];
  const selectedIds = new Set<string>();

  const available = () =>
    pool.filter((item) => !selectedIds.has(item.candidate.event.id));

  const take = (
    item: AssessedCandidate | undefined,
    slot: HighlightSlot,
    formula: AiSlotFormula,
    scoreFn: (assessment: AiHighlightAssessment) => number,
  ) => {
    if (!item || selected.length >= limit) return;
    if (selectedIds.has(item.candidate.event.id)) return;

    const slotScore = scoreFn(item.assessment);
    selected.push(
      toAiHighlight(item.candidate, item.assessment, slot, formula, slotScore),
    );
    selectedIds.add(item.candidate.event.id);
  };

  const pickBest = (
    scoreFn: (assessment: AiHighlightAssessment) => number,
  ): AssessedCandidate | undefined => {
    const remaining = available();
    if (remaining.length === 0) return undefined;
    return [...remaining].sort((a, b) => compareByScore(a, b, scoreFn))[0];
  };

  for (const slot of buildAiDetourSlotSequence(limit)) {
    if (selected.length >= limit) break;

    const { formula, scoreFn } = scoreConfigForSlot(slot);
    const best = pickBest(scoreFn);

    if (best && meetsAiSlotFloor(slot, best.assessment)) {
      take(best, slot, formula, scoreFn);
      continue;
    }

    const fallback = pickBest(wildcardSlotScore);
    if (fallback) take(fallback, "wildcard", "wildcard", wildcardSlotScore);
  }

  return applyLightDiversity(selected.slice(0, limit), pool);
}

/**
 * Évite une sur-représentation venue/ville si une alternative proche existe.
 * Ne remplace jamais un candidat nettement meilleur (écart > tolérance).
 * Garantit un eventId unique dans le résultat (garde si un swap a déjà pris un id plus loin).
 */
export function applyLightDiversity(
  selected: EventHighlight[],
  pool: AssessedCandidate[],
): EventHighlight[] {
  const usedIds = new Set<string>();
  const result: EventHighlight[] = [];

  for (const item of selected) {
    // Déjà émis plus tôt (ex. swap diversité) → pas de doublon ; tenter un remplissage.
    if (usedIds.has(item.event.id)) {
      const filler = pickDiversityAlternative(item, result, pool, usedIds);
      if (filler) {
        result.push(filler.highlight);
        usedIds.add(filler.id);
      }
      continue;
    }

    const overVenue = isOverVenueCap(result, item.event.venue);
    const overCity = isOverCityCap(result, item.event.city);

    if (!overVenue && !overCity) {
      result.push(item);
      usedIds.add(item.event.id);
      continue;
    }

    const alternative = pickDiversityAlternative(item, result, pool, usedIds);
    if (alternative) {
      result.push(alternative.highlight);
      usedIds.add(alternative.id);
    } else {
      // Pas d’alternative proche → on conserve le meilleur malgré la concentration.
      result.push(item);
      usedIds.add(item.event.id);
    }
  }

  return result;
}

function pickDiversityAlternative(
  item: EventHighlight,
  result: EventHighlight[],
  pool: AssessedCandidate[],
  usedIds: Set<string>,
): { id: string; highlight: EventHighlight } | undefined {
  const itemScore = item.score;
  const slot = item.slot ?? "wildcard";
  const { formula, scoreFn } = scoreConfigForSlot(slot);

  const alternative = [...pool]
    .filter((candidate) => !usedIds.has(candidate.candidate.event.id))
    .filter((candidate) => candidate.candidate.event.id !== item.event.id)
    .map((candidate) => ({
      candidate,
      score: scoreFn(candidate.assessment),
    }))
    .filter(({ candidate, score }) => {
      if (score < itemScore - AI_DETOUR_DIVERSITY_SCORE_TOLERANCE) {
        return false;
      }
      if (isOverVenueCap(result, candidate.candidate.event.venue)) {
        return false;
      }
      if (isOverCityCap(result, candidate.candidate.event.city)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.index - b.candidate.index;
    })[0];

  if (!alternative) return undefined;

  const id = alternative.candidate.candidate.event.id;
  return {
    id,
    highlight: toAiHighlight(
      alternative.candidate.candidate,
      alternative.candidate.assessment,
      slot,
      formula,
      alternative.score,
    ),
  };
}

function isOverVenueCap(
  current: EventHighlight[],
  venue: string | null,
): boolean {
  const key = normalizePlace(venue);
  if (!key) return false;
  const count = current.filter(
    (item) => normalizePlace(item.event.venue) === key,
  ).length;
  return count >= AI_DETOUR_MAX_PER_VENUE;
}

function isOverCityCap(current: EventHighlight[], city: string | null): boolean {
  const key = normalizePlace(city);
  if (!key) return false;
  const count = current.filter(
    (item) => normalizePlace(item.event.city) === key,
  ).length;
  return count >= AI_DETOUR_MAX_PER_CITY;
}

function normalizePlace(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreConfigForSlot(slot: HighlightSlot): {
  formula: AiSlotFormula;
  scoreFn: (assessment: AiHighlightAssessment) => number;
} {
  switch (slot) {
    case "strong-event":
      return { formula: "strong", scoreFn: strongEventScore };
    case "easy-to-miss":
      return { formula: "easy-to-miss", scoreFn: easyToMissScore };
    case "worth-planning":
      return { formula: "worth-planning", scoreFn: worthPlanningScore };
    case "rare-local":
      return { formula: "rare-local", scoreFn: rareLocalScore };
    case "wildcard":
    case "local-gem":
      return { formula: "wildcard", scoreFn: wildcardSlotScore };
  }
}

function toAiHighlight(
  candidate: EventHighlight,
  assessment: AiHighlightAssessment,
  slot: HighlightSlot,
  formula: AiSlotFormula,
  slotScore: number,
): EventHighlight {
  return {
    ...candidate,
    score: slotScore,
    slot,
    selectionSource: "ai",
    aiSelection: {
      formula,
      slotScore,
      appeal: assessment.appeal,
      missRisk: assessment.missRisk,
      planningNeed: assessment.planningNeed,
      localRarity: assessment.localRarity,
      likelyDemand: assessment.likelyDemand,
      confidence: assessment.confidence,
      aiReasons: assessment.reasons,
    },
  };
}

function compareByScore(
  a: AssessedCandidate,
  b: AssessedCandidate,
  scoreFn: (assessment: AiHighlightAssessment) => number,
): number {
  const scoreDiff = scoreFn(b.assessment) - scoreFn(a.assessment);
  if (scoreDiff !== 0) return scoreDiff;

  const confidenceDiff = b.assessment.confidence - a.assessment.confidence;
  if (confidenceDiff !== 0) return confidenceDiff;

  return a.index - b.index;
}
