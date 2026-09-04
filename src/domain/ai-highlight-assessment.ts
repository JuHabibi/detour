import type { DetourEvent } from "@/domain/event";

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

/** Payload neutre envoyé à l’IA — sans scores déterministes. */
export type AiHighlightEventInput = {
  eventId: string;
  title: string;
  description: string | null;
  category: string | null;
  genre: string | null;
  venue: string | null;
  city: string | null;
  source: string | null;
  conditions: string | null;
  startAt: string;
  endAt: string | null;
  hasRegistrationUrl: boolean;
};

export const AI_HIGHLIGHT_SHORTLIST_SIZE = 60;
export const AI_HIGHLIGHT_BATCH_SIZE = 10;

export function toAiHighlightEventInput(event: DetourEvent): AiHighlightEventInput {
  return {
    eventId: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    genre: event.genre,
    venue: event.venue,
    city: event.city,
    source: event.source,
    conditions: event.conditions,
    startAt: event.startAt,
    endAt: event.endAt,
    hasRegistrationUrl: Boolean(event.registrationUrl),
  };
}

/**
 * Parse + normalise une réponse JSON brute du provider.
 * Ignore les entrées invalides ; clamp dans les bornes.
 * Ne crée pas d’évaluation fantôme pour les eventId manquants.
 */
export function parseAiHighlightAssessments(
  raw: unknown,
  expectedEventIds: string[],
): AiHighlightAssessment[] {
  const expected = new Set(expectedEventIds);
  const items = extractAssessmentArray(raw);
  const byId = new Map<string, AiHighlightAssessment>();

  for (const item of items) {
    const parsed = parseOneAssessment(item);
    if (!parsed) continue;
    if (!expected.has(parsed.eventId)) continue;
    byId.set(parsed.eventId, parsed);
  }

  // Ordre stable = ordre de la shortlist attendue.
  return expectedEventIds
    .map((id) => byId.get(id))
    .filter((item): item is AiHighlightAssessment => item != null);
}

function extractAssessmentArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.assessments)) return record.assessments;
    if (Array.isArray(record.results)) return record.results;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}

function parseOneAssessment(raw: unknown): AiHighlightAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  const eventId = typeof item.eventId === "string" ? item.eventId.trim() : "";
  if (!eventId) return null;

  const reasons = Array.isArray(item.reasons)
    ? item.reasons
        .filter((reason): reason is string => typeof reason === "string")
        .map((reason) => reason.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    eventId,
    appeal: clampScore(item.appeal, 0, 5),
    missRisk: clampScore(item.missRisk, 0, 5),
    planningNeed: clampScore(item.planningNeed, 0, 5),
    localRarity: clampScore(item.localRarity, 0, 5),
    likelyDemand: clampScore(item.likelyDemand, 0, 5),
    confidence: clampScore(item.confidence, 0, 1),
    reasons,
  };
}

export function clampScore(value: unknown, min: number, max: number): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

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
