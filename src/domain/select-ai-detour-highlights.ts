import {
  combinedAiScore,
  type AiHighlightAssessment,
} from "@/domain/ai-highlight-assessment";
import type {
  AiHighlightSelectionMeta,
  EventHighlight,
  HighlightSlot,
} from "@/domain/select-detour-highlights";

export type AiSlotFormula = AiHighlightSelectionMeta["formula"];

/** Radar culturel local — jusqu’à 10 événements. */
export const AI_DETOUR_DEFAULT_LIMIT = 10;

type AssessedCandidate = {
  candidate: EventHighlight;
  assessment: AiHighlightAssessment;
  index: number;
};

/**
 * Séquence IA cible (limit ≥ 10) :
 * 2 strong, 2 easy-to-miss, 2 worth-planning, 2 rare-local, 2 wildcard.
 * Limites plus petites : mix réduit, wildcards en complément.
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

/** Fort potentiel global. */
export function strongEventScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.appeal * 2 + assessment.likelyDemand * 2 + assessment.planningNeed
  );
}

/** Facile à rater malgré l’intérêt. */
export function easyToMissScore(assessment: AiHighlightAssessment): number {
  return assessment.missRisk * 2 + assessment.appeal + assessment.localRarity;
}

/** Nécessite de l’anticipation. */
export function worthPlanningScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.planningNeed * 2 + assessment.likelyDemand + assessment.appeal
  );
}

/** Localement rare / inhabituel. */
export function rareLocalScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.localRarity * 2 + assessment.appeal + assessment.likelyDemand
  );
}

/** Wildcard éditorial. */
export function wildcardSlotScore(assessment: AiHighlightAssessment): number {
  return combinedAiScore(assessment);
}

/**
 * Un slot thématique n’est rempli que si le signal principal est crédible.
 * Sinon → meilleur restant en wildcard (pas de quota artificiel).
 */
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

/**
 * Sélection éditoriale « Faites un détour » pilotée par l’IA.
 * Limité aux événements évalués. Retourne [] si aucun assessment → fallback appelant.
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

    // Candidat trop faible pour le quota thématique → meilleur restant.
    const fallback = pickBest(wildcardSlotScore);
    if (fallback) take(fallback, "wildcard", "wildcard", wildcardSlotScore);
  }

  return selected.slice(0, limit);
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
