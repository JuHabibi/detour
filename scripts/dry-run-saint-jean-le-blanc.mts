/**
 * Dry-run Saint-Jean-le-Blanc — aucune écriture DB.
 * Usage : bun scripts/dry-run-saint-jean-le-blanc.mts
 */
import { classifyEventRelevance } from "../src/domain/events/classify-event-relevance";
import { SaintJeanLeBlancEventAdapter } from "../src/infrastructure/sources/saint-jean-le-blanc/saint-jean-le-blanc.adapter";

const WINDOW_DAYS = 180;
const CULTURAL = new Set(["culture", "culture_leisure"]);

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const adapter = new SaintJeanLeBlancEventAdapter();
  const result = await adapter.collectUpcomingEvents({ from, to });

  const classified = result.events.map((event) => {
    const c = classifyEventRelevance(event);
    return {
      id: event.id,
      title: event.title,
      category: event.category,
      startAt: event.startAt,
      venue: event.venue,
      relevance: c.relevance,
      reason: c.reason,
      decision: CULTURAL.has(c.relevance) ? "relevant" : "rejected",
    };
  });

  const relevant = classified.filter((e) => e.decision === "relevant");
  const rejected = classified.filter((e) => e.decision === "rejected");

  console.log("=== Saint-Jean-le-Blanc dry-run ===\n");
  console.log(
    JSON.stringify(
      {
        window: { from: from.toISOString(), to: to.toISOString() },
        fetched: result.stats.listPagesFetched,
        parsed: result.stats.discovered,
        normalized: result.stats.published,
        detailsFetched: result.stats.detailsFetched,
        detailsFailed: result.stats.detailsFailed,
        relevant: relevant.length,
        rejected: rejected.length,
        errors: result.exclusions.filter((e) =>
          ["http_error", "detail_parse_error", "unparseable_date"].includes(
            e.reason,
          ),
        ),
        stats: result.stats,
        relevantSample: relevant.slice(0, 8),
        rejectedSample: rejected.slice(0, 8),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
