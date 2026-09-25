/**
 * Funnel qualité éditoriale — lecture seule (DB / pipeline Home).
 *
 * Usage :
 *   bun --env-file=.env.local scripts/audit-editorial-quality-funnel.mts
 *   bun --env-file=.env.local scripts/audit-editorial-quality-funnel.mts --trace=openagenda:123
 *
 * N’écrit pas en DB, ne déclenche pas de sync. Sortie JSON stdout + résumé stderr.
 */
import { writeFileSync } from "node:fs";
import {
  buildEditorialQualityFunnel,
  findEventTrace,
} from "../src/application/debug/build-editorial-quality-funnel";
import { EventService } from "../src/application/event.service";
import { createMemoryAiAssessmentCacheStore } from "../src/application/ai/ai-assessment-cache";
import { buildSourceIngestionStats } from "../src/application/ingestion/source-ingestion-stats";
import { getAiConfig } from "../src/config/ai-config";
import { createHomeEventSource } from "../src/infrastructure/create-detour-event-source";
import { createHighlightAssessmentProvider } from "../src/infrastructure/ai/create-highlight-assessment-provider";
import {
  countExplorerEvents,
  listExplorerEventsPage,
  type ExplorerResolvedFilters,
} from "../src/infrastructure/db/explorer-events.repository";
import type { DetourEvent } from "../src/domain/events/event";

const WINDOW_DAYS = 180;
const EXPLORER_PAGE = 100;
const EXPLORER_MAX_PAGES = 50;

function parseTraceIds(argv: string[]): string[] {
  const ids: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--trace=")) {
      ids.push(
        ...arg
          .slice("--trace=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return ids;
}

async function loadExplorerSlice(params: {
  from: Date;
  to: Date;
}): Promise<{
  totalRepresentatives: number;
  representativeEvents: DetourEvent[];
  representativesComplete: boolean;
}> {
  const filters: ExplorerResolvedFilters = {
    temporal: { mode: "bounded", from: params.from, to: params.to },
    searchPattern: null,
    productCategory: null,
    cityKey: null,
  };

  const totalRepresentatives = await countExplorerEvents({ filters });
  const representativeEvents: DetourEvent[] = [];
  let after: { startAt: Date; id: string } | null = null;
  let pages = 0;
  let complete = true;

  while (pages < EXPLORER_MAX_PAGES) {
    pages += 1;
    const page = await listExplorerEventsPage({
      filters,
      after,
      limit: EXPLORER_PAGE,
    });
    representativeEvents.push(...page.events);
    if (!page.nextAfter) break;
    after = page.nextAfter;
    if (pages === EXPLORER_MAX_PAGES && page.nextAfter) {
      complete = false;
    }
  }

  if (representativeEvents.length < totalRepresentatives) {
    complete = false;
  }

  return { totalRepresentatives, representativeEvents, representativesComplete: complete };
}

async function main() {
  const traceIds = parseTraceIds(process.argv.slice(2));
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const aiConfig = getAiConfig();
  const service = new EventService(
    createHomeEventSource(),
    createHighlightAssessmentProvider(),
    {
      aiConfig: {
        ...aiConfig,
        enabled: false,
        displayMode: "disabled",
      },
      cacheStore: createMemoryAiAssessmentCacheStore(),
    },
  );

  const pipeline = await service.buildUpcomingPipeline({ from, to });
  const result = await service.getUpcomingEvents({ from, to });

  const sourceIngestion = buildSourceIngestionStats({
    ingestion: pipeline.ingestion,
    classifiedEvents: pipeline.classifiedEvents,
    dedupedEvents: pipeline.events,
    duplicates: pipeline.duplicates,
  });

  let explorer: Awaited<ReturnType<typeof loadExplorerSlice>> | null = null;
  try {
    explorer = await loadExplorerSlice({ from, to });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[funnel] Explorer slice skipped: ${message}`);
  }

  const report = buildEditorialQualityFunnel({
    window: { from, to },
    ingestedBeforeFreshness: pipeline.ingestion.events.length,
    classifiedEvents: pipeline.classifiedEvents,
    afterDedup: pipeline.events,
    duplicates: pipeline.duplicates,
    rankedCandidates: pipeline.rankedCandidates,
    aiShortlist: pipeline.aiShortlist,
    aiShortlistInclusion: pipeline.aiShortlistInclusion,
    highlights: result.highlights,
    sourceIngestion,
    explorer,
    traceEventIds: traceIds.length > 0 ? traceIds : undefined,
  });

  console.log(JSON.stringify(report, null, 2));

  console.error("--- résumé funnel ---");
  console.error(
    `window ${report.window.from} → ${report.window.to}`,
  );
  console.error(
    `corpus: ingested=${report.corpus.ingestedBeforeFreshness} fresh=${report.corpus.afterFreshness} (-${report.corpus.droppedByFreshness} freshness)`,
  );
  console.error(
    `classif: culture=${report.classification.culture} leisure=${report.classification.culture_leisure} uncertain=${report.classification.uncertain} out=${report.classification.out_of_scope}`,
  );
  console.error(
    `radar: dedup=${report.radar.afterDedup} scored=${report.radar.scoredCandidates} shortlist=${report.radar.shortlistSize} selected=${report.radar.selectedFinal} (${report.radar.selectionSource}, outsideShortlist=${report.radar.selectedOutsideAiShortlist})`,
  );
  if (report.explorer) {
    console.error(
      `explorer: reps=${report.explorer.totalRepresentatives} listed=${report.explorer.representativesListed} complete=${report.explorer.representativesComplete} nonCultural=${report.explorer.nonCulturalVolume}`,
    );
  } else {
    console.error("explorer: (non chargé)");
  }

  for (const id of traceIds) {
    const trace = findEventTrace(report, id);
    console.error(`trace ${id}:`, trace ?? "not in default traces / corpus");
  }

  const outPath = new URL("./audit-editorial-quality-funnel.json", import.meta.url);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(`Wrote ${outPath.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
