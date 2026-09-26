import type { UpcomingEventsResult } from "@/application/event.service";
import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import { resolveEditorialBadge } from "@/domain/editorial/resolve-editorial-badge";
import type { EventHighlight } from "@/domain/editorial/select-detour-highlights";
import type { DetourEvent } from "@/domain/events/event";
import { parisCalendarDaysBetween } from "@/domain/time/paris-calendar-days";

/** Assessment IA exporté — dimensions brutes uniquement. */
export type RadarEditorialAuditAiAssessment = {
  appeal: number;
  missRisk: number;
  planningNeed: number;
  localRarity: number;
  likelyDemand: number;
  confidence: number;
  reasons: string[];
};

/** Bloc moteur — séparable du reste pour review éditoriale. */
export type RadarEditorialAuditEngine = {
  deterministicRank: number | null;
  deterministicScore: number | null;
  planningScore: number | null;
  candidatePoolInclusionReasons: string[];
  aiAssessment: RadarEditorialAuditAiAssessment | null;
  selectedInRadar: boolean;
  radarRank: number | null;
  slot: string | null;
  editorialBadge: string | null;
};

/**
 * Mesure d’anticipation Détour (faits DB / absents).
 * Ne confond pas sélection Radar, vue à l’écran, ni ouverture de fiche.
 */
export type RadarEditorialAuditTiming = {
  /**
   * `events.created_at` — première insertion connue dans la DB Détour.
   * Ce n’est pas la date d’annonce organisateur. Survit aux sync (upsert).
   */
  detourFirstInsertedAt: string | null;
  /**
   * Jours civils Paris de `detourFirstInsertedAt` jusqu’au `startAt` **actuel**
   * de la fiche (mis à jour au sync). Ce n’est pas le délai dont on disposait
   * à l’insertion si la date de début a été reportée depuis.
   */
  daysUntilStartAtDetourFirstInsert: number | null;
  /**
   * Première fois où l’événement a figuré dans la sélection Radar
   * effectivement affichable (highlights finaux).
   * Toujours `null` = **non mesuré** (pas encore d’observation persistée).
   */
  firstRadarDisplayableSelectedAt: null;
  /**
   * Toujours `null` = **non mesuré** (dépend de
   * `firstRadarDisplayableSelectedAt`).
   */
  daysUntilStartAtFirstRadarDisplayableSelected: null;
};

/**
 * Une entrée d’audit : faits source en racine, moteur dans `engine`.
 * Aucune invention — absents → null.
 */
export type RadarEditorialAuditEvent = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  venue: string | null;
  city: string | null;
  category: string | null;
  genre: string | null;
  conditions: string | null;
  source: string | null;
  sourceUrl: string | null;
  registrationUrl: string | null;
  timing: RadarEditorialAuditTiming;
  engine: RadarEditorialAuditEngine;
};

export type RadarEditorialAuditExport = {
  generatedAt: string;
  poolSize: number;
  /**
   * Légende stable pour les consommateurs de l’export JSON.
   * La 1ʳᵉ sélection Radar affichable n’est pas encore enregistrée.
   */
  timingSemantics: {
    detourFirstInsertedAt: string;
    daysUntilStartAtDetourFirstInsert: string;
    firstRadarDisplayableSelectedAt: string;
    daysUntilStartAtFirstRadarDisplayableSelected: string;
  };
  events: RadarEditorialAuditEvent[];
};

export const RADAR_AUDIT_TIMING_SEMANTICS = {
  detourFirstInsertedAt:
    "events.created_at — première insertion connue dans la DB Détour ; pas la date d’annonce organisateur ; non écrasée par les synchronisations (ON CONFLICT ne met pas à jour created_at).",
  daysUntilStartAtDetourFirstInsert:
    "Jours civils Europe/Paris entre detourFirstInsertedAt et le startAt actuel de la fiche. Si l’événement a été reporté depuis l’insertion, ce nombre ne décrit plus le délai dont on disposait à l’époque (le startAt d’origine n’est pas conservé).",
  firstRadarDisplayableSelectedAt:
    "Non mesuré : aucune observation persistée de la sélection Radar affichable (highlights finaux). Distinct de « vu à l’écran » et de « fiche ouverte ». Valeur toujours null.",
  daysUntilStartAtFirstRadarDisplayableSelected:
    "Non mesuré : dépend de firstRadarDisplayableSelectedAt. Valeur toujours null.",
} as const;

type BuildRadarEditorialAuditInput = Pick<
  UpcomingEventsResult,
  "aiShortlist" | "aiShortlistInclusion" | "highlights" | "aiAssessments"
> & {
  generatedAt?: string;
};

/**
 * Export audit éditorial du AI candidate pool (max 60).
 * Faits source séparés du bloc `engine` (scores / IA / sélection).
 */
export function buildRadarEditorialAudit(
  input: BuildRadarEditorialAuditInput,
): RadarEditorialAuditExport {
  const assessmentById = new Map(
    input.aiAssessments.map((item) => [item.eventId, item] as const),
  );
  const radarById = new Map(
    input.highlights.map((item, index) => [
      item.event.id,
      { highlight: item, rank: index + 1 },
    ]),
  );

  const events = input.aiShortlist.map((candidate, index) =>
    toAuditEvent({
      candidate,
      deterministicRank: index + 1,
      inclusionReasons: input.aiShortlistInclusion[candidate.event.id] ?? [],
      assessment: assessmentById.get(candidate.event.id) ?? null,
      radar: radarById.get(candidate.event.id) ?? null,
    }),
  );

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    poolSize: events.length,
    timingSemantics: { ...RADAR_AUDIT_TIMING_SEMANTICS },
    events,
  };
}

function toAuditEvent(params: {
  candidate: EventHighlight;
  deterministicRank: number;
  inclusionReasons: string[];
  assessment: AiHighlightAssessment | null;
  radar: { highlight: EventHighlight; rank: number } | null;
}): RadarEditorialAuditEvent {
  const { event } = params.candidate;
  const radarHighlight = params.radar?.highlight ?? null;

  return {
    ...factualFields(event),
    engine: {
      deterministicRank: params.deterministicRank,
      deterministicScore: params.candidate.score,
      planningScore: params.candidate.planningScore,
      candidatePoolInclusionReasons: [...params.inclusionReasons],
      aiAssessment: params.assessment
        ? {
            appeal: params.assessment.appeal,
            missRisk: params.assessment.missRisk,
            planningNeed: params.assessment.planningNeed,
            localRarity: params.assessment.localRarity,
            likelyDemand: params.assessment.likelyDemand,
            confidence: params.assessment.confidence,
            reasons: [...params.assessment.reasons],
          }
        : null,
      selectedInRadar: params.radar != null,
      radarRank: params.radar?.rank ?? null,
      slot: radarHighlight?.slot ?? null,
      editorialBadge: resolveAuditEditorialBadge(radarHighlight),
    },
  };
}

function factualFields(
  event: DetourEvent,
): Omit<RadarEditorialAuditEvent, "engine"> {
  const detourFirstInsertedAt = event.detourFirstInsertedAt?.trim() || null;
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    venue: event.venue,
    city: event.city,
    category: event.category,
    genre: event.genre,
    conditions: event.conditions,
    source: event.source,
    sourceUrl: event.sourceUrl,
    registrationUrl: event.registrationUrl,
    timing: {
      detourFirstInsertedAt,
      daysUntilStartAtDetourFirstInsert:
        detourFirstInsertedAt != null
          ? parisCalendarDaysBetween(detourFirstInsertedAt, event.startAt)
          : null,
      firstRadarDisplayableSelectedAt: null,
      daysUntilStartAtFirstRadarDisplayableSelected: null,
    },
  };
}

function resolveAuditEditorialBadge(
  highlight: EventHighlight | null,
): string | null {
  if (!highlight?.aiSelection) return null;
  const ai = highlight.aiSelection;
  return resolveEditorialBadge({
    planningNeed: ai.planningNeed,
    localRarity: ai.localRarity,
    missRisk: ai.missRisk,
    confidence: ai.confidence,
    reasons: ai.aiReasons,
    hasRegistrationUrl: Boolean(highlight.event.registrationUrl),
  });
}
