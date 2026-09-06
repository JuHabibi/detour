/**
 * Audit pipeline candidat « Faites un détour » (sans appeler l’IA).
 * Usage : npx tsx scripts/audit-candidate-pool.mts
 */
import { writeFileSync } from "node:fs";
import { classifyEventRelevance } from "../src/domain/events/classify-event-relevance";
import { deduplicateEvents, normalizeText } from "../src/domain/events/deduplicate-events";
import { AI_HIGHLIGHT_SHORTLIST_SIZE } from "../src/application/ai/build-ai-highlight-shortlist";
import {
  buildAiHighlightShortlist,
  type AiShortlistInclusionReason,
} from "../src/application/ai/build-ai-highlight-shortlist";
import {
  HIGHLIGHT_WEIGHTS,
  rankDetourHighlightCandidates,
  type HighlightReason,
} from "../src/domain/editorial/select-detour-highlights";
import type { DetourEvent } from "../src/domain/events/event";
import { createDetourEventSource } from "../src/infrastructure/create-detour-event-source";

const WINDOW_DAYS = 180;
const TOP20 = 20;

function matchesRouve(event: DetourEvent): boolean {
  return /jean[-\s]?paul\s+rouve|\brouve\b/i.test(
    `${event.title} ${event.description ?? ""}`,
  );
}

function matchesRegles(event: DetourEvent): boolean {
  return normalizeText(event.title).includes("les regles du jeu");
}

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const rawEvents = await createDetourEventSource().fetchUpcomingEvents({
    from,
    to,
  });

  const classifiedEvents = rawEvents.map((event) => {
    const classification = classifyEventRelevance(event);
    return {
      ...event,
      relevance: classification.relevance,
      relevanceReason: classification.reason,
    };
  });

  const { events: deduped, duplicates } = deduplicateEvents(classifiedEvents);
  const ranked = rankDetourHighlightCandidates(deduped);
  const top20 = ranked.slice(0, TOP20);
  const built = buildAiHighlightShortlist(ranked);
  const aiShortlist = built.shortlist;

  const inclusionCounts: Record<AiShortlistInclusionReason, number> = {
    "deterministic-top": 0,
    "planning-top": 0,
    "booking-top": 0,
    "peripheral-top": 0,
    "future-top": 0,
  };
  for (const reasons of built.inclusionById.values()) {
    for (const reason of reasons) {
      inclusionCounts[reason] += 1;
    }
  }

  const rouvesRankedIndex = ranked.findIndex((item) =>
    matchesRouve(item.event),
  );
  const rouvesRanked =
    rouvesRankedIndex >= 0 ? ranked[rouvesRankedIndex] : null;
  const rouvesInPool =
    rouvesRanked != null &&
    aiShortlist.some((item) => item.event.id === rouvesRanked.event.id);

  const culturalRelevant = classifiedEvents.filter(
    (e) => e.relevance === "culture" || e.relevance === "culture_leisure",
  );

  const report = {
    meta: {
      from: from.toISOString(),
      to: to.toISOString(),
      windowDays: WINDOW_DAYS,
      auditedAt: new Date().toISOString(),
      weights: HIGHLIGHT_WEIGHTS,
      aiShortlistSize: AI_HIGHLIGHT_SHORTLIST_SIZE,
      top20Size: TOP20,
    },
    pool: {
      rawCount: rawEvents.length,
      classifiedCount: classifiedEvents.length,
      culturalRelevantCount: culturalRelevant.length,
      dedupedCount: deduped.length,
      duplicatesRemoved: duplicates.length,
      scoredCandidatesCount: ranked.length,
      highlightCandidatesTop20: top20.length,
      bucketSizesBeforeUnion: built.bucketSizes,
      bucketSumBeforeDedup: Object.values(built.bucketSizes).reduce(
        (a, b) => a + b,
        0,
      ),
      aiShortlistAfterUnion: aiShortlist.length,
      inclusionReasonCountsAmongPool: inclusionCounts,
      note: "Pool IA = union de buckets (det30 + plan15 + book15 + peri15 + fut15), cap 60, ordre d’insertion déterministe.",
    },
    rouves: rouvesRanked
      ? {
          id: rouvesRanked.event.id,
          title: rouvesRanked.event.title,
          rankDeterministic: rouvesRankedIndex + 1,
          score: rouvesRanked.score,
          planningScore: rouvesRanked.planningScore,
          inAiPool: rouvesInPool,
          inclusionReasons:
            built.inclusionById.get(rouvesRanked.event.id) ?? [],
        }
      : null,
    shortlist: aiShortlist.map((item, index) => ({
      rank: index + 1,
      id: item.event.id,
      title: item.event.title,
      city: item.event.city,
      score: item.score,
      planningScore: item.planningScore,
      inclusionReasons: built.inclusionById.get(item.event.id) ?? [],
    })),
    reglesDuJeu: classifiedEvents.filter(matchesRegles).map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      venue: e.venue,
      city: e.city,
    })),
  };

  const outPath = "scripts/audit-candidate-pool.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.pool, null, 2));
  console.log("rouves", JSON.stringify(report.rouves, null, 2));
  console.error(`Wrote ${outPath} (shortlist ${aiShortlist.length})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
