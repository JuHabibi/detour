import {
  combinedAiScore,
  type AiHighlightAssessment,
} from "@/domain/ai-highlight-assessment";
import type {
  AiHighlightSelectionMeta,
  EventHighlight,
  HighlightSlot,
} from "@/domain/select-detour-highlights";

export type AiSlotFormula =
  AiHighlightSelectionMeta["formula"];

type AssessedCandidate = {
  candidate: EventHighlight;
  assessment: AiHighlightAssessment;
  index: number;
};

const SLOT_ORDER: HighlightSlot[] = [
  "strong-event",
  "local-gem",
  "worth-planning",
  "wildcard",
];

/** strong-event : recognition pèse autant que appeal. */
export function strongEventScore(assessment: AiHighlightAssessment): number {
  return assessment.appeal * 2 + assessment.recognition * 2 + assessment.planningValue;
}

/** local-gem : favorise la découverte locale. */
export function localGemScore(assessment: AiHighlightAssessment): number {
  return assessment.discoveryValue * 2 + assessment.appeal;
}

/** worth-planning : anticipation, pas urgence / stock. */
export function worthPlanningScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.planningValue * 2 + assessment.appeal + assessment.recognition
  );
}

/** wildcard : somme indicative des 4 dimensions. */
export function wildcardSlotScore(assessment: AiHighlightAssessment): number {
  return combinedAiScore(assessment);
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
  const limit = options?.limit ?? 4;
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

  for (const slot of SLOT_ORDER) {
    if (selected.length >= limit) break;

    const { formula, scoreFn } = scoreConfigForSlot(slot);
    const best = pickBest(scoreFn);
    if (best) take(best, slot, formula, scoreFn);
    else {
      const fallback = pickBest(wildcardSlotScore);
      if (fallback) take(fallback, slot, "wildcard", wildcardSlotScore);
    }
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
    case "local-gem":
      return { formula: "local-gem", scoreFn: localGemScore };
    case "worth-planning":
      return { formula: "worth-planning", scoreFn: worthPlanningScore };
    case "wildcard":
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
      discoveryValue: assessment.discoveryValue,
      planningValue: assessment.planningValue,
      recognition: assessment.recognition,
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
