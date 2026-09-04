import { EventService } from "@/application/event.service";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import { HomePage } from "@/components/HomePage";
import type {
  AiHighlightDebug,
  EventDuplicateDebug,
  HighlightDebug,
} from "@/components/EventsDebugPanel";
import { createHighlightAssessmentProvider } from "@/infrastructure/ai/create-highlight-assessment-provider";
import { OrleansEventAdapter } from "@/infrastructure/sources/orleans/orleans-event.adapter";
import type { EventHighlight } from "@/domain/select-detour-highlights";
import { combinedAiScore } from "@/domain/ai-highlight-assessment";

const UPCOMING_WINDOW_DAYS = 180;

const eventService = new EventService(
  new OrleansEventAdapter(),
  createHighlightAssessmentProvider(),
);

function formatScoresUsed(highlight: EventHighlight): string | undefined {
  const ai = highlight.aiSelection;
  if (!ai) return undefined;
  return [
    `${ai.formula}=${ai.slotScore}`,
    `a${ai.appeal}`,
    `d${ai.discoveryValue}`,
    `p${ai.planningValue}`,
    `r${ai.recognition}`,
  ].join(" · ");
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
  };
}

export default async function Page() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

  const {
    events,
    highlights,
    highlightCandidates,
    aiShortlist,
    scoredCandidatesCount,
    aiAssessments,
    duplicates,
    rawCount,
    classifiedEvents,
  } = await eventService.getUpcomingEvents({ from, to });

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
      discoveryValue: assessment.discoveryValue,
      planningValue: assessment.planningValue,
      recognition: assessment.recognition,
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

  return (
    <HomePage
      events={events.map((event) => mapDetourEventToEventItem(event))}
      highlights={highlights.map((highlight) =>
        mapDetourEventToEventItem(highlight.event),
      )}
      debugMeta={{
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
        aiAssessments: aiDebug.length > 0 ? aiDebug : undefined,
      }}
    />
  );
}
