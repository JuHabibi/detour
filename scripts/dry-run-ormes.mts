/**
 * Dry-run Ville d'Ormes (catégorie Culture) — aucune écriture DB.
 * Usage : bun scripts/dry-run-ormes.mts
 */
import { OrmesEventAdapter } from "../src/infrastructure/sources/ormes/ormes.adapter";

const WINDOW_DAYS = 180;

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const adapter = new OrmesEventAdapter();
  const result = await adapter.collectUpcomingEvents({ from, to });

  console.log(
    JSON.stringify(
      {
        window: { from: from.toISOString(), to: to.toISOString() },
        stats: result.stats,
        exclusions: result.exclusions.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          reason: e.reason,
          detail: e.detail ?? null,
        })),
        events: result.events,
        sample: result.events[0] ?? null,
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
