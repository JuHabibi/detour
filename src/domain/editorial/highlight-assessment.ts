export type AiHighlightAssessment = {
  eventId: string;
  appeal: number;
  missRisk: number;
  planningNeed: number;
  localRarity: number;
  likelyDemand: number;
  confidence: number;
  reasons: string[];
};

/** Somme debug indicative — ne pilote pas la sélection UI. */
export function combinedAiScore(assessment: AiHighlightAssessment): number {
  return (
    assessment.appeal +
    assessment.missRisk +
    assessment.planningNeed +
    assessment.localRarity +
    assessment.likelyDemand
  );
}
