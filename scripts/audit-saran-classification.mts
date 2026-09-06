/**
 * Script temporaire — audit classification Saran (180 jours).
 * Usage : npx tsx scripts/audit-saran-classification.mts
 */
import { classifyEventRelevance } from "../src/domain/classify-event-relevance";
import { buildSaranClassificationAudit } from "../src/application/debug/saran-ingestion-debug";
import { SaranEventAdapter } from "../src/infrastructure/sources/saran/saran-event.adapter";

const WINDOW_DAYS = 180;

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const events = await new SaranEventAdapter().fetchUpcomingEvents({ from, to });
  const classified = events.map((event) => {
    const classification = classifyEventRelevance(event);
    return {
      ...event,
      relevance: classification.relevance,
      relevanceReason: classification.reason,
    };
  });

  const adapterByEventId = new Map(
    classified.map((event) => [event.id, "saran"] as const),
  );
  const audit = buildSaranClassificationAudit({
    classifiedEvents: classified,
    adapterByEventId,
  });

  const outOfScope = audit.rows
    .filter((row) => row.relevance === "out_of_scope")
    .map((row) => {
      const full = classified.find((event) => event.id === row.eventId);
      return {
        title: row.title,
        relevanceReason: row.relevanceReason,
        category: row.category,
        genre: row.genre,
        venue: row.venue,
        description: full?.description ?? null,
        sourceUrl: full?.sourceUrl ?? null,
        startAt: full?.startAt ?? null,
      };
    });

  const uncertain = audit.rows
    .filter((row) => row.relevance === "uncertain")
    .map((row) => {
      const full = classified.find((event) => event.id === row.eventId);
      return {
        title: row.title,
        relevanceReason: row.relevanceReason,
        category: row.category,
        genre: row.genre,
        venue: row.venue,
        description: full?.description ?? null,
        sourceUrl: full?.sourceUrl ?? null,
        startAt: full?.startAt ?? null,
      };
    });

  console.log(
    JSON.stringify(
      {
        summary: {
          total: audit.total,
          culture: audit.culture,
          cultureLeisure: audit.cultureLeisure,
          outOfScope: audit.outOfScope,
          uncertain: audit.uncertain,
        },
        cultureTitles: audit.rows
          .filter((row) => row.relevance === "culture")
          .map((row) => row.title),
        outOfScope,
        uncertainCompact: uncertain.map((row) => ({
          title: row.title,
          venue: row.venue,
          reason: row.relevanceReason,
          hasDescription: Boolean(row.description),
          descriptionSnippet: row.description
            ? row.description.replace(/\s+/g, " ").trim().slice(0, 120)
            : null,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
