import type {
  AiHighlightDebug,
  EventDuplicateDebug,
  EventsDebugMeta,
  HighlightDebug,
  PlanningEventDebug,
} from "@/components/EventsDebugPanel";
import type { UpcomingEventsResult } from "@/application/event.service";
import { combinedAiScore } from "@/domain/ai-highlight-assessment";
import { resolveEditorialBadge } from "@/domain/resolve-editorial-badge";
import type { EventHighlight } from "@/domain/select-detour-highlights";
import { shortenCacheKey } from "@/infrastructure/ai/ai-assessment-cache-key";

function formatScoresUsed(highlight: EventHighlight): string | undefined {
  const ai = highlight.aiSelection;
  if (!ai) return undefined;
  return [
    `${ai.formula}=${ai.slotScore}`,
    `a${ai.appeal}`,
    `m${ai.missRisk}`,
    `p${ai.planningNeed}`,
    `lr${ai.localRarity}`,
    `ld${ai.likelyDemand}`,
  ].join(" · ");
}

function resolveHighlightEditorialBadge(
  highlight: EventHighlight,
): string | null {
  const ai = highlight.aiSelection;
  if (!ai) return null;
  return resolveEditorialBadge({
    planningNeed: ai.planningNeed,
    localRarity: ai.localRarity,
    likelyDemand: ai.likelyDemand,
    missRisk: ai.missRisk,
    confidence: ai.confidence,
    reasons: ai.aiReasons,
    hasRegistrationUrl: Boolean(highlight.event.registrationUrl),
  });
}

function toHighlightDebug(
  highlight: EventHighlight,
  options?: {
    rank?: number;
    deterministicRank?: number;
    aiRank?: number;
  },
): HighlightDebug {
  return {
    title: highlight.event.title,
    score: highlight.score,
    planningScore: highlight.planningScore,
    reasons: highlight.reasons,
    source: highlight.event.source,
    city: highlight.event.city,
    hasRegistration: Boolean(highlight.event.registrationUrl),
    rank: options?.rank,
    slot: highlight.slot,
    selectionSource: highlight.selectionSource,
    deterministicRank: options?.deterministicRank,
    aiRank: options?.aiRank,
    scoresUsed: formatScoresUsed(highlight),
    editorialBadge: resolveHighlightEditorialBadge(highlight),
  };
}

function toPlanningDebug(
  item: UpcomingEventsResult["planningEvents"][number],
): PlanningEventDebug {
  return {
    title: item.event.title,
    pool: item.pool,
    selectionSource: item.selectionSource,
    planningValue: item.planningValue,
    planningScore: item.planningScore,
    selectionScore: item.selectionScore,
    rankInPool: item.rankInPool,
    date: item.event.startAt,
    city: item.event.city,
  };
}

/** Construit le meta debug à partir du résultat EventService (sans secrets). */
export function buildEventsDebugMeta(
  result: UpcomingEventsResult,
): EventsDebugMeta {
  const {
    events,
    highlights,
    planningEvents,
    highlightCandidates,
    aiShortlist,
    aiShortlistInclusion,
    aiShortlistBucketSizes,
    scoredCandidatesCount,
    aiAssessments,
    aiMeta,
    duplicates,
    rawCount,
    classifiedEvents,
    sourceIngestion,
    saranDuplicates,
    saranClassificationAudit,
  } = result;

  const byId = new Map(
    classifiedEvents.map((event) => [event.id, event] as const),
  );
  const shortlistRankById = new Map(
    aiShortlist.map((item, index) => [item.event.id, index + 1]),
  );
  const candidateRankById = new Map(
    highlightCandidates.map((item, index) => [item.event.id, index + 1]),
  );

  const duplicateDebug: EventDuplicateDebug[] = duplicates.map((duplicate) => {
    const kept = byId.get(duplicate.keptId);
    const removed = byId.get(duplicate.duplicateId);

    return {
      keptTitle: kept?.title ?? duplicate.keptId,
      duplicateTitle: removed?.title ?? duplicate.duplicateId,
      date: kept?.startAt ?? removed?.startAt ?? "",
      venue: kept?.venue ?? removed?.venue ?? null,
      city: kept?.city ?? removed?.city ?? null,
      reason: duplicate.reason,
    };
  });

  const aiDebugBase = aiAssessments.map((assessment) => {
    const event = byId.get(assessment.eventId);
    return {
      eventId: assessment.eventId,
      title: event?.title ?? assessment.eventId,
      deterministicRank: shortlistRankById.get(assessment.eventId),
      appeal: assessment.appeal,
      missRisk: assessment.missRisk,
      planningNeed: assessment.planningNeed,
      localRarity: assessment.localRarity,
      likelyDemand: assessment.likelyDemand,
      confidence: assessment.confidence,
      reasons: assessment.reasons,
      combined: combinedAiScore(assessment),
    };
  });

  const rankByCombinedDesc = [...aiDebugBase]
    .sort((a, b) => b.combined - a.combined)
    .map((item, index) => [item.eventId, index + 1] as const);

  const aiRankById = new Map(rankByCombinedDesc);

  const aiDebug: AiHighlightDebug[] = aiDebugBase.map((assessment) => {
    const rank = aiRankById.get(assessment.eventId);
    return {
      ...assessment,
      aiRankTotal: rank,
      aiRankDetour: rank,
    };
  });

  return {
    rawCount,
    dedupedCount: events.length,
    duplicateCount: duplicates.length,
    scoredCandidatesCount,
    duplicates: duplicateDebug,
    highlights: highlights.map((highlight) =>
      toHighlightDebug(highlight, {
        deterministicRank:
          shortlistRankById.get(highlight.event.id) ??
          candidateRankById.get(highlight.event.id),
        aiRank: aiRankById.get(highlight.event.id),
      }),
    ),
    highlightCandidates: highlightCandidates.map((highlight, index) =>
      toHighlightDebug(highlight, { rank: index + 1 }),
    ),
    aiShortlist: aiShortlist.map((highlight, index) => ({
      eventId: highlight.event.id,
      title: highlight.event.title,
      rank: index + 1,
      score: highlight.score,
      planningScore: highlight.planningScore,
      city: highlight.event.city,
      inclusionReasons:
        aiShortlistInclusion[highlight.event.id] ?? [],
    })),
    aiShortlistBucketSizes,
    aiAssessments: aiDebug.length > 0 ? aiDebug : undefined,
    planningEvents:
      planningEvents.length > 0
        ? planningEvents.map(toPlanningDebug)
        : undefined,
    sourceIngestion:
      sourceIngestion.length > 0 ? sourceIngestion : undefined,
    saranDuplicates:
      saranDuplicates.length > 0 ? saranDuplicates : undefined,
    saranClassificationAudit:
      saranClassificationAudit.total > 0
        ? saranClassificationAudit
        : undefined,
    aiRuntime: {
      mode: aiMeta.displayMode,
      source: aiMeta.source,
      cacheKeyShort: aiMeta.cacheKey
        ? shortenCacheKey(aiMeta.cacheKey)
        : null,
      assessedAt: aiMeta.assessedAt,
      canRunManual: aiMeta.enabled && aiMeta.mode === "manual",
    },
  };
}
