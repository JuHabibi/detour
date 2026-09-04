/**
 * Script temporaire — audit couverture géographique V1 (180 jours).
 * Usage : npx tsx scripts/audit-v1-city-coverage.mts
 */
import { writeFileSync } from "node:fs";
import { OrleansEventAdapter } from "../src/infrastructure/sources/orleans/orleans-event.adapter";
import { buildV1CityCoverageReport } from "../src/domain/v1-city-coverage";

const WINDOW_DAYS = 180;

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const adapter = new OrleansEventAdapter();
  const events = await adapter.fetchUpcomingEvents({ from, to });
  const report = buildV1CityCoverageReport({
    events,
    from,
    to,
    windowDays: WINDOW_DAYS,
  });

  const outPath = new URL("./audit-v1-city-coverage.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        totalEventsInCorpus: report.totalEventsInCorpus,
        totalEventsOnV1: report.totalEventsOnV1,
        distinctSourcesOnV1: report.distinctSourcesOnV1,
        none: report.communesNone,
        weak: report.communesWeak,
        good: report.communesGood,
        rows: report.rows.map((row) => ({
          commune: row.commune,
          events: row.events,
          sources: row.sources,
          topSources: row.topSources,
          withImage: row.withImage,
          withBooking: row.withBooking,
          withCoords: row.withCoords,
          coverage: row.coverage,
        })),
      },
      null,
      2,
    ),
  );
  console.error(`Wrote ${outPath.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
