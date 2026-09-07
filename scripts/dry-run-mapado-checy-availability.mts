/**
 * Dry-run enrichissement Mapado Chécy (aucune écriture DB).
 * Usage : npx tsx --env-file=.env.local scripts/dry-run-mapado-checy-availability.mts
 */
import { Pool } from "pg";
import { enrichMapadoAvailability } from "../src/application/availability/enrich-mapado-availability";
import type { DetourEvent } from "../src/domain/events/event";
import { MAPADO_CHECY_TENANT } from "../src/infrastructure/ticketing/mapado/mapado-config";

const WINDOW_DAYS = 180;

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query<{
      id: string;
      title: string;
      description: string | null;
      image_url: string | null;
      start_at: Date;
      end_at: Date | null;
      venue: string | null;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
      category: string | null;
      genre: string | null;
      conditions: string | null;
      source: string | null;
      source_url: string | null;
      registration_url: string | null;
    }>(
      `
SELECT id, title, description, image_url, start_at, end_at, venue, city,
       latitude, longitude, category, genre, conditions, source, source_url,
       registration_url
FROM events
WHERE is_active = true
  AND start_at < $2
  AND COALESCE(end_at, start_at) >= $1
ORDER BY start_at ASC, id ASC
`.trim(),
      [from.toISOString(), to.toISOString()],
    );

    const events: DetourEvent[] = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      startAt: row.start_at.toISOString(),
      endAt: row.end_at ? row.end_at.toISOString() : null,
      venue: row.venue,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      category: row.category,
      genre: row.genre,
      conditions: row.conditions,
      source: row.source,
      sourceUrl: row.source_url,
      registrationUrl: row.registration_url,
    }));

    console.log("DB upcoming events:", events.length);

    let fetchCount = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      fetchCount += 1;
      return fetch(input, init);
    };

    const enrichment = await enrichMapadoAvailability({
      tenant: MAPADO_CHECY_TENANT,
      events,
      dryRun: true,
      fetchImpl,
    });

    console.log(
      JSON.stringify(
        {
          tenantId: enrichment.tenantId,
          examinedCount: enrichment.examinedCount,
          catalogSize: enrichment.catalogSize,
          matchCount: enrichment.matchCount,
          availableCount: enrichment.availableCount,
          soldOutOnlineCount: enrichment.soldOutOnlineCount,
          soldOutCount: enrichment.soldOutCount,
          unknownCount: enrichment.unknownCount,
          portalFetchOk: enrichment.portalFetchOk,
          httpRequests: fetchCount,
          errors: enrichment.errors,
          matched: enrichment.matched.map((m) => ({
            title: m.title,
            status: m.status,
            eventUrl: m.eventUrl,
          })),
        },
        null,
        2,
      ),
    );

    const bourgeois = enrichment.matched.find((m) =>
      /bourgeois/i.test(m.title),
    );
    const chameau = enrichment.matched.find((m) => /chameau/i.test(m.title));
    console.log("\nCHECK Bourgeois:", bourgeois?.status ?? "NOT MATCHED");
    console.log("CHECK Chameau:", chameau?.status ?? "NOT MATCHED");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
