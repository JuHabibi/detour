/**
 * Audit couverture géographique V1 — corpus produit mode database.
 * Source de vérité : events PG actifs/upcoming (même filtre que listUpcomingActive).
 *
 * Usage :
 *   bun --env-file=.env.local scripts/audit-v1-city-coverage.mts
 *   npx tsx --env-file=.env.local scripts/audit-v1-city-coverage.mts
 */
import { writeFileSync } from "node:fs";
import pg from "pg";
import { buildV1CityCoverageReport } from "../src/application/debug/v1-city-coverage";
import {
  mapEventRowToDetourEvent,
  type EventRow,
} from "../src/infrastructure/db/event-row.mapper";

const WINDOW_DAYS = 180;

/**
 * Aligné sur `LIST_UPCOMING_SQL` (event.repository) — sans JOIN availability
 * (n’impacte pas le set d’events, seulement des champs optionnels hors couverture).
 */
const LIST_UPCOMING_ACTIVE_SQL = `
SELECT
  e.id,
  e.adapter_id,
  e.title,
  e.description,
  e.image_url,
  e.image_credit,
  e.image_license,
  e.image_source_url,
  e.start_at,
  e.end_at,
  e.all_day,
  e.venue,
  e.city,
  e.latitude,
  e.longitude,
  e.category,
  e.genre,
  e.conditions,
  e.source,
  e.source_url,
  e.registration_url,
  e.is_active,
  e.created_at,
  e.updated_at,
  e.last_seen_at
FROM events e
WHERE e.is_active = true
  AND e.start_at < $2
  AND COALESCE(e.end_at, e.start_at) >= $1
ORDER BY e.start_at ASC, e.id ASC
`.trim();

async function loadUpcomingActiveFromDb(params: {
  from: Date;
  to: Date;
}): Promise<{ events: ReturnType<typeof mapEventRowToDetourEvent>[]; countsByAdapter: Record<string, number> }> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required (use --env-file=.env.local)");
  }

  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query<EventRow>(LIST_UPCOMING_ACTIVE_SQL, [
      params.from.toISOString(),
      params.to.toISOString(),
    ]);

    const countsByAdapter: Record<string, number> = {};
    const events = result.rows.map((row) => {
      countsByAdapter[row.adapter_id] =
        (countsByAdapter[row.adapter_id] ?? 0) + 1;
      return mapEventRowToDetourEvent(row);
    });

    return { events, countsByAdapter };
  } finally {
    await pool.end();
  }
}

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const { events, countsByAdapter } = await loadUpcomingActiveFromDb({
    from,
    to,
  });

  const coverage = buildV1CityCoverageReport({
    events,
    from,
    to,
    windowDays: WINDOW_DAYS,
  });

  const report = {
    corpus: {
      origin: "database",
      query: "events.is_active + upcoming window (listUpcomingActive)",
      countsByAdapter,
    },
    ...coverage,
  };

  const outPath = new URL("./audit-v1-city-coverage.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        corpus: report.corpus,
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
