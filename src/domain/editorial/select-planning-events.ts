import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";
import type {
  EventHighlight,
  HighlightSelectionSource,
} from "@/domain/editorial/select-detour-highlights";
import { rankDetourHighlightCandidates } from "@/domain/editorial/select-detour-highlights";

const CULTURAL_RELEVANCE = new Set(["culture", "culture_leisure"]);
const DEFAULT_LIMIT = 4;
const MIN_DAYS_AHEAD = 30;
const MAX_PER_SOURCE = 2;
/** Seuil IA : vrai besoin d’anticipation. */
const MIN_AI_PLANNING_VALUE = 3;
/** Seuil déterministe : planningScore déjà non trivial. */
const MIN_DETERMINISTIC_PLANNING_SCORE = 2;

export type PlanningPool = "ai" | "deterministic-fallback";

export type PlanningEvent = {
  event: DetourEvent;
  selectionSource: HighlightSelectionSource;
  /** Pool de sélection — l’IA remplit d’abord, le fallback complète. */
  pool: PlanningPool;
  /** Rang dans le pool (après tri, avant diversité). */
  rankInPool: number;
  /** Score interne de tri dans le pool. */
  selectionScore: number;
  planningValue: number | null;
  planningScore: number;
  appeal: number | null;
  recognition: number | null;
  discoveryValue: number | null;
};

/**
 * Sélection « À prévoir » — anticipation (>30 jours), complémentaire à Faites un détour.
 * Pool IA d’abord, fallback déterministe seulement pour compléter.
 * Réutilise les assessments existants ; pas de nouvel appel provider.
 */
export function selectPlanningEvents(params: {
  events: DetourEvent[];
  aiAssessments?: AiHighlightAssessment[];
  excludedEventIds?: Iterable<string>;
  now?: Date;
  limit?: number;
  /** Candidats déterministes déjà scorés (optionnel — sinon recalculés). */
  deterministicCandidates?: EventHighlight[];
}): PlanningEvent[] {
  const {
    events,
    aiAssessments = [],
    excludedEventIds = [],
    now = new Date(),
    limit = DEFAULT_LIMIT,
  } = params;

  if (limit <= 0) return [];

  const excluded = new Set(excludedEventIds);
  const assessmentById = new Map(
    aiAssessments.map((item) => [item.eventId, item] as const),
  );
  const candidatesById = new Map(
    (
      params.deterministicCandidates ??
      rankDetourHighlightCandidates(events, { now })
    ).map((item) => [item.event.id, item] as const),
  );

  const baseEligible = events.filter((event) =>
    isBaseEligible(event, excluded, now),
  );

  const aiPool = withPoolRanks(
    baseEligible
      .filter((event) => {
        const assessment = assessmentById.get(event.id);
        return (
          assessment != null &&
          assessment.planningNeed >= MIN_AI_PLANNING_VALUE
        );
      })
      .map((event) =>
        scoreAiCandidate(event, assessmentById.get(event.id)!, candidatesById),
      )
      .sort(comparePlanningEvents),
    "ai",
  );

  const selectedFromAi = pickWithLightDiversity(aiPool, limit);

  if (selectedFromAi.length >= limit) {
    return selectedFromAi.slice(0, limit);
  }

  const selectedIds = new Set(selectedFromAi.map((item) => item.event.id));

  const deterministicPool = withPoolRanks(
    baseEligible
      .filter((event) => {
        if (selectedIds.has(event.id)) return false;
        if (assessmentById.has(event.id)) return false;
        const planningScore = candidatesById.get(event.id)?.planningScore ?? 0;
        return planningScore >= MIN_DETERMINISTIC_PLANNING_SCORE;
      })
      .map((event) => scoreDeterministicCandidate(event, candidatesById))
      .sort(comparePlanningEvents),
    "deterministic-fallback",
  );

  const selectedFromFallback = pickWithLightDiversity(
    deterministicPool,
    limit - selectedFromAi.length,
    selectedFromAi,
  );

  return [...selectedFromAi, ...selectedFromFallback];
}

function isBaseEligible(
  event: DetourEvent,
  excluded: Set<string>,
  now: Date,
): boolean {
  if (excluded.has(event.id)) return false;
  if (!event.relevance || !CULTURAL_RELEVANCE.has(event.relevance)) return false;
  if (!startsInMoreThanDays(event.startAt, now, MIN_DAYS_AHEAD)) return false;
  return true;
}

function scoreAiCandidate(
  event: DetourEvent,
  assessment: AiHighlightAssessment,
  candidatesById: Map<string, EventHighlight>,
): Omit<PlanningEvent, "pool" | "rankInPool"> {
  return {
    event,
    selectionSource: "ai",
    selectionScore:
      assessment.planningNeed * 3 +
      assessment.appeal +
      assessment.likelyDemand,
    planningValue: assessment.planningNeed,
    planningScore: candidatesById.get(event.id)?.planningScore ?? 0,
    appeal: assessment.appeal,
    recognition: assessment.likelyDemand,
    discoveryValue: assessment.missRisk,
  };
}

function scoreDeterministicCandidate(
  event: DetourEvent,
  candidatesById: Map<string, EventHighlight>,
): Omit<PlanningEvent, "pool" | "rankInPool"> {
  const candidate = candidatesById.get(event.id);
  const planningScore = candidate?.planningScore ?? 0;
  const deterministicScore = candidate?.score ?? 0;
  const hasBooking = Boolean(event.registrationUrl);

  return {
    event,
    selectionSource: "deterministic",
    selectionScore:
      planningScore * 5 + (hasBooking ? 3 : 0) + Math.min(deterministicScore, 5),
    planningValue: null,
    planningScore,
    appeal: null,
    recognition: null,
    discoveryValue: null,
  };
}

function withPoolRanks(
  ranked: Array<Omit<PlanningEvent, "pool" | "rankInPool">>,
  pool: PlanningPool,
): PlanningEvent[] {
  return ranked.map((item, index) => ({
    ...item,
    pool,
    rankInPool: index + 1,
  }));
}

function comparePlanningEvents(
  a: Omit<PlanningEvent, "pool" | "rankInPool">,
  b: Omit<PlanningEvent, "pool" | "rankInPool">,
): number {
  if (b.selectionScore !== a.selectionScore) {
    return b.selectionScore - a.selectionScore;
  }

  const appealDiff = (b.appeal ?? 0) - (a.appeal ?? 0);
  if (appealDiff !== 0) return appealDiff;

  const recognitionDiff = (b.recognition ?? 0) - (a.recognition ?? 0);
  if (recognitionDiff !== 0) return recognitionDiff;

  const discoveryDiff = (b.discoveryValue ?? 0) - (a.discoveryValue ?? 0);
  if (discoveryDiff !== 0) return discoveryDiff;

  const dateA = Date.parse(a.event.startAt);
  const dateB = Date.parse(b.event.startAt);
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB) && dateA !== dateB) {
    return dateA - dateB;
  }

  return a.event.id.localeCompare(b.event.id);
}

/** Diversité légère : 1 titre, 1 venue, max 2 par source. */
function pickWithLightDiversity(
  ranked: PlanningEvent[],
  limit: number,
  alreadySelected: PlanningEvent[] = [],
): PlanningEvent[] {
  if (limit <= 0) return [];

  const selected: PlanningEvent[] = [];
  const titles = new Set<string>();
  const venues = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const selectedIds = new Set(alreadySelected.map((item) => item.event.id));

  for (const item of alreadySelected) {
    const titleKey = normalizeKey(item.event.title);
    const venueKey = normalizeKey(item.event.venue);
    const sourceKey = normalizeKey(item.event.source);
    if (titleKey) titles.add(titleKey);
    if (venueKey) venues.add(venueKey);
    if (sourceKey) {
      sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1);
    }
  }

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (selectedIds.has(item.event.id)) continue;

    const titleKey = normalizeKey(item.event.title);
    if (titleKey && titles.has(titleKey)) continue;

    const venueKey = normalizeKey(item.event.venue);
    if (venueKey && venues.has(venueKey)) continue;

    const sourceKey = normalizeKey(item.event.source);
    if (sourceKey) {
      const count = sourceCounts.get(sourceKey) ?? 0;
      if (count >= MAX_PER_SOURCE) continue;
    }

    selected.push(item);
    selectedIds.add(item.event.id);
    if (titleKey) titles.add(titleKey);
    if (venueKey) venues.add(venueKey);
    if (sourceKey) {
      sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1);
    }
  }

  return selected;
}

function normalizeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function startsInMoreThanDays(
  startAt: string,
  now: Date,
  days: number,
): boolean {
  const start = Date.parse(startAt);
  if (Number.isNaN(start)) return false;
  return start - now.getTime() > days * 24 * 60 * 60 * 1000;
}
