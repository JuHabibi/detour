import { createDetourEventSource } from "../src/infrastructure/create-detour-event-source";
import { classifyEventRelevance } from "../src/domain/events/classify-event-relevance";
import { deduplicateEvents } from "../src/domain/events/deduplicate-events";
import {
  HIGHLIGHT_WEIGHTS,
  rankDetourHighlightCandidates,
} from "../src/domain/editorial/select-detour-highlights";
import { AI_HIGHLIGHT_SHORTLIST_SIZE } from "../src/domain/ai-highlight-assessment";
import { writeFileSync } from "node:fs";

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 180);
  const raw = await createDetourEventSource().fetchUpcomingEvents({ from, to });

  const checy = raw.filter((e) =>
    (e.city || "").toLowerCase().includes("chécy") ||
    (e.city || "").toLowerCase().includes("checy"),
  );
  console.log("Chécy count:", checy.length);
  for (const e of checy) {
    console.log("-", e.startAt.slice(0, 10), "|", e.title, "|", e.venue);
  }

  const jp = raw.filter((e) =>
    /jean[-\s]?paul\s+rouve/i.test(`${e.title} ${e.description || ""}`),
  );
  console.log("\nJean-Paul Rouve exact matches:", jp.length);
  for (const e of jp) {
    console.log(
      JSON.stringify(
        {
          id: e.id,
          title: e.title,
          city: e.city,
          venue: e.venue,
          startAt: e.startAt,
          source: e.source,
          registrationUrl: e.registrationUrl,
          category: e.category,
          desc: (e.description || "").slice(0, 300),
        },
        null,
        2,
      ),
    );
  }

  const rouveWord = raw.filter((e) =>
    /\brouve\b/i.test(`${e.title} ${e.description || ""}`),
  );
  console.log("\nWord-boundary rouve matches:", rouveWord.length);
  for (const e of rouveWord) {
    console.log("-", e.id, "|", e.title, "|", e.city, "|", e.startAt.slice(0, 16));
  }

  // OpenAgenda direct — several query styles
  const queries = [
    'search(title_fr, "Rouve")',
    'search(description_fr, "Rouve")',
    'search(title_fr, "Jean-Paul")',
    'location_city like "Chécy" and firstdate_begin >= date\'2026-09-04\'',
  ];

  for (const where of queries) {
    const url =
      "https://data.orleans-metropole.fr/api/explore/v2.1/catalog/datasets/agenda-orleans-metropole/records?limit=50&where=" +
      encodeURIComponent(where);
    const res = await fetch(url);
    const data = (await res.json()) as {
      total_count?: number;
      results?: Array<Record<string, unknown>>;
    };
    console.log("\nOA query:", where, "→", data.total_count);
    for (const r of data.results ?? []) {
      const title = String(r.title_fr ?? "");
      if (
        /rouve|jean-paul/i.test(title) ||
        where.includes("Chécy")
      ) {
        console.log(
          "-",
          r.uid,
          "|",
          title,
          "|",
          r.location_city,
          "|",
          r.firstdate_begin,
          "|",
          r.statut_evenement,
        );
      }
    }
  }

  // Full pipeline rank for any JP Rouve found
  const classified = raw.map((event) => {
    const c = classifyEventRelevance(event);
    return { ...event, relevance: c.relevance, relevanceReason: c.reason };
  });
  const { events: deduped } = deduplicateEvents(classified);
  const ranked = rankDetourHighlightCandidates(deduped);

  const target = ranked.find((item) =>
    /jean[-\s]?paul\s+rouve|\brouve\b/i.test(
      `${item.event.title} ${item.event.description || ""}`,
    ),
  );

  if (target) {
    const rank =
      ranked.findIndex((item) => item.event.id === target.event.id) + 1;
    console.log("\nRanked Rouve-like:", {
      rank,
      score: target.score,
      planning: target.planningScore,
      reasons: target.reasons,
      title: target.event.title,
      city: target.event.city,
      inTop20: rank <= 20,
      inAi30: rank <= AI_HIGHLIGHT_SHORTLIST_SIZE,
      weights: HIGHLIGHT_WEIGHTS,
    });
  } else {
    console.log("\nNo Rouve-like event in ranked candidates.");
  }

  // Also dump humour / spectacle Chécy with person names
  const checyRanked = ranked.filter((item) =>
    (item.event.city || "").toLowerCase().includes("checy") ||
    (item.event.city || "").toLowerCase().includes("chécy"),
  );
  console.log("\nChécy ranked count:", checyRanked.length);
  for (const item of checyRanked) {
    const rank =
      ranked.findIndex((r) => r.event.id === item.event.id) + 1;
    console.log(
      rank,
      item.score,
      item.planningScore,
      item.reasons.join("+"),
      "|",
      item.event.title,
    );
  }

  writeFileSync(
    "scripts/audit-rouve-search.json",
    JSON.stringify(
      {
        checyTitles: checy.map((e) => ({
          id: e.id,
          title: e.title,
          startAt: e.startAt,
          venue: e.venue,
        })),
        jpExact: jp,
        rouveWord: rouveWord.map((e) => ({
          id: e.id,
          title: e.title,
          city: e.city,
          startAt: e.startAt,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
