/**
 * Fige la shortlist IA actuelle (corpus benchmark).
 * Usage :
 *   npx tsx --env-file=.env.local scripts/freeze-ai-highlight-corpus.mts
 *
 * Écrit : scripts/fixtures/ai-highlight-corpus.json
 * Aucun appel OpenAI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyEventRelevance } from "../src/domain/events/classify-event-relevance";
import { deduplicateEvents } from "../src/domain/events/deduplicate-events";
import { buildAiHighlightShortlist } from "../src/application/ai/build-ai-highlight-shortlist";
import { filterStillActiveEvents } from "../src/domain/events/is-event-still-active";
import { rankDetourHighlightCandidates } from "../src/domain/editorial/select-detour-highlights";
import {
  toAiHighlightEventInput,
  type AiHighlightEventInput,
} from "../src/application/ai/highlight-assessment-input";
import type { DetourEvent } from "../src/domain/events/event";
import { createDetourEventSource } from "../src/infrastructure/create-detour-event-source";

const WINDOW_DAYS = 180;
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "fixtures", "ai-highlight-corpus.json");

export type AiHighlightCorpus = {
  meta: {
    frozenAt: string;
    from: string;
    to: string;
    windowDays: number;
    shortlistSize: number;
    fields: (keyof AiHighlightEventInput)[];
    note: string;
  };
  /** Events shortlist dans l’ordre du pool IA (champs métier complets). */
  events: DetourEvent[];
  /** Exactement le payload user envoyé au provider. */
  providerInputs: AiHighlightEventInput[];
};

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const raw = await createDetourEventSource().fetchUpcomingEvents({ from, to });
  const active = filterStillActiveEvents(raw, from);
  const classified = active.map((event) => {
    const classification = classifyEventRelevance(event);
    return {
      ...event,
      relevance: classification.relevance,
      relevanceReason: classification.reason,
    };
  });
  const { events: deduped } = deduplicateEvents(classified);
  const ranked = rankDetourHighlightCandidates(deduped);
  const { shortlist } = buildAiHighlightShortlist(ranked);
  const events = shortlist.map((item) => item.event);
  const providerInputs = events.map(toAiHighlightEventInput);

  const corpus: AiHighlightCorpus = {
    meta: {
      frozenAt: new Date().toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      windowDays: WINDOW_DAYS,
      shortlistSize: events.length,
      fields: [
        "eventId",
        "title",
        "description",
        "category",
        "genre",
        "venue",
        "city",
        "source",
        "conditions",
        "startAt",
        "endAt",
        "hasRegistrationUrl",
      ],
      note: "Corpus figé pour compare-ai-highlight-models — ne pas régénérer pendant une campagne.",
    },
    events,
    providerInputs,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(corpus, null, 2));
  console.log(
    JSON.stringify(
      {
        wrote: OUT_PATH,
        shortlistSize: events.length,
        frozenAt: corpus.meta.frozenAt,
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
