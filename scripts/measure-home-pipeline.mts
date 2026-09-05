/**
 * Mesure TEMPORAIRE perf / fraîcheur — lecture seule comportement produit.
 * Usage : npx tsx --env-file=.env.local scripts/measure-home-pipeline.mts
 *
 * Sortie : scripts/measure-home-pipeline.json (+ résumé stdout)
 */
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { EventService } from "../src/application/event.service";
import { getAiConfig } from "../src/config/ai-config";
import { classifyEventRelevance } from "../src/domain/classify-event-relevance";
import { deduplicateEvents } from "../src/domain/deduplicate-events";
import { buildAiHighlightShortlist } from "../src/domain/build-ai-highlight-shortlist";
import { filterStillActiveEvents } from "../src/domain/is-event-still-active";
import {
  rankDetourHighlightCandidates,
  selectDetourHighlights,
} from "../src/domain/select-detour-highlights";
import {
  AI_DETOUR_DEFAULT_LIMIT,
  selectAiDetourHighlights,
} from "../src/domain/select-ai-detour-highlights";
import { createHighlightAssessmentProvider } from "../src/infrastructure/ai/create-highlight-assessment-provider";
import { createMemoryAiAssessmentCacheStore } from "../src/infrastructure/ai/ai-assessment-cache";
import { OrleansEventAdapter } from "../src/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "../src/infrastructure/sources/saran/saran-event.adapter";
import {
  createCachedDetourEventSource,
  createDetourEventSource,
} from "../src/infrastructure/create-detour-event-source";
import {
  createMemoryIngestionReadThrough,
  type IngestionCacheStats,
} from "../src/infrastructure/ingestion-cache";

const WINDOW_DAYS = 180;

async function timed<T>(
  label: string,
  fn: () => Promise<T> | T,
): Promise<{ label: string; ms: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round((performance.now() - start) * 10) / 10;
  return { label, ms, result };
}

function countPastStarted(
  events: { startAt: string; endAt: string | null }[],
  now: Date,
): { startAtPast: number; stillActiveByEnd: number } {
  let startAtPast = 0;
  let stillActiveByEnd = 0;
  const nowMs = now.getTime();
  for (const event of events) {
    const start = Date.parse(event.startAt);
    if (Number.isNaN(start) || start >= nowMs) continue;
    startAtPast += 1;
    const end = event.endAt ? Date.parse(event.endAt) : Number.NaN;
    if (!Number.isNaN(end) && end > nowMs) stillActiveByEnd += 1;
  }
  return { startAtPast, stillActiveByEnd };
}

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);
  const aiConfig = getAiConfig();

  const orleans = new OrleansEventAdapter();
  const saran = new SaranEventAdapter();

  const orleansTimed = await timed("adapter.orleans_uncached", () =>
    orleans.fetchUpcomingEvents({ from, to }),
  );
  const saranTimed = await timed("adapter.saran_uncached", () =>
    saran.fetchUpcomingEvents({ from, to }),
  );

  const uncachedCompositeTimed = await timed(
    "ingestion.composite_uncached",
    () => createDetourEventSource().fetchUpcomingEvents({ from, to }),
  );

  const ingestionStats: IngestionCacheStats = { hits: 0, misses: 0 };
  const cachedSource = createCachedDetourEventSource(
    createMemoryIngestionReadThrough({ stats: ingestionStats }),
  );

  const cachedCold = await timed("ingestion.cached_cold", () =>
    cachedSource.fetchUpcomingEvents({ from, to }),
  );
  const cachedWarm = await timed("ingestion.cached_warm", () =>
    cachedSource.fetchUpcomingEvents({
      from: new Date(from.getTime() + 30_000),
      to: new Date(to.getTime() + 30_000),
    }),
  );

  const activeEvents = filterStillActiveEvents(cachedCold.result, from);

  const classifyTimed = await timed("pipeline.classification", () =>
    activeEvents.map((event) => {
      const classification = classifyEventRelevance(event);
      return {
        ...event,
        relevance: classification.relevance,
        relevanceReason: classification.reason,
      };
    }),
  );

  const dedupTimed = await timed("pipeline.dedup", () =>
    deduplicateEvents(classifyTimed.result),
  );

  const rankingTimed = await timed("pipeline.ranking", () =>
    rankDetourHighlightCandidates(dedupTimed.result.events),
  );

  const shortlistTimed = await timed("pipeline.shortlist", () =>
    buildAiHighlightShortlist(rankingTimed.result),
  );

  const serviceStats: IngestionCacheStats = { hits: 0, misses: 0 };
  const service = new EventService(
    createCachedDetourEventSource(
      createMemoryIngestionReadThrough({ stats: serviceStats }),
    ),
    createHighlightAssessmentProvider(),
    {
      aiConfig,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    },
  );

  const serviceCold = await timed("service.getUpcomingEvents_cold", () =>
    service.getUpcomingEvents({ from, to }),
  );
  const serviceWarm = await timed("service.getUpcomingEvents_warm", () =>
    service.getUpcomingEvents({
      from: new Date(from.getTime() + 45_000),
      to: new Date(to.getTime() + 45_000),
    }),
  );

  const result = serviceCold.result;
  const selectionTimed = await timed("pipeline.highlight_selection", () => {
    const ai = selectAiDetourHighlights(
      result.aiShortlist,
      result.aiAssessments,
      { limit: AI_DETOUR_DEFAULT_LIMIT },
    );
    if (ai.length > 0) return ai;
    return selectDetourHighlights(result.events, {
      limit: AI_DETOUR_DEFAULT_LIMIT,
    });
  });

  const pastPool = countPastStarted(result.events, from);
  const pastHighlights = countPastStarted(
    result.highlights.map((item) => item.event),
    from,
  );

  const stages = [
    orleansTimed,
    saranTimed,
    uncachedCompositeTimed,
    cachedCold,
    cachedWarm,
    classifyTimed,
    dedupTimed,
    rankingTimed,
    shortlistTimed,
    serviceCold,
    serviceWarm,
    selectionTimed,
  ].map(({ label, ms }) => ({ label, ms }));

  const report = {
    meta: {
      measuredAt: new Date().toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      windowDays: WINDOW_DAYS,
      aiEnabled: aiConfig.enabled,
      aiMode: aiConfig.mode,
      aiDisplayMode: aiConfig.displayMode,
      note: "Script temporaire — compare uncached vs cached ingestion (mémoire).",
      baselineBeforeCache: {
        ingestionMs: 1182,
        serviceColdMs: 1390,
        serviceWarmMs: 1523,
        eventsAfterDedup: 765,
        measuredAt: "2026-09-05T08:29:46.850Z",
      },
    },
    counts: {
      orleansRaw: orleansTimed.result.length,
      saranRaw: saranTimed.result.length,
      compositeUncached: uncachedCompositeTimed.result.length,
      afterActiveFilter: activeEvents.length,
      afterDedup: dedupTimed.result.events.length,
      duplicates: dedupTimed.result.duplicates.length,
      rankedCulture: rankingTimed.result.length,
      shortlist: shortlistTimed.result.shortlist.length,
      highlights: result.highlights.length,
      assessments: result.aiAssessments.length,
      aiSourceCold: result.aiMeta.source,
      aiSourceWarm: serviceWarm.result.aiMeta.source,
      serviceEvents: result.events.length,
    },
    cache: {
      ingestionHits: ingestionStats.hits,
      ingestionMisses: ingestionStats.misses,
      serviceIngestionHits: serviceStats.hits,
      serviceIngestionMisses: serviceStats.misses,
    },
    freshness: {
      poolStartAtPast: pastPool.startAtPast,
      poolStillActiveByEnd: pastPool.stillActiveByEnd,
      highlightsStartAtPast: pastHighlights.startAtPast,
      highlightsStillActiveByEnd: pastHighlights.stillActiveByEnd,
    },
    timingsMs: Object.fromEntries(stages.map((s) => [s.label, s.ms])),
    stages,
    comparison: {
      ingestionColdMs: cachedCold.ms,
      ingestionWarmMs: cachedWarm.ms,
      serviceColdMs: serviceCold.ms,
      serviceWarmMs: serviceWarm.ms,
      networkFetchesApprox:
        "uncached paths hit Orleans+Saran; cached warm should be 0 extra ingest HTTP",
    },
  };

  writeFileSync(
    "scripts/measure-home-pipeline.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  console.error("Wrote scripts/measure-home-pipeline.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
