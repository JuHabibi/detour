import { rankDetourHighlightCandidates } from "@/domain/editorial/select-detour-highlights";
import { classifyEventRelevance } from "@/domain/events/classify-event-relevance";
import type { DetourEvent } from "@/domain/events/event";
import { filterStillActiveEvents } from "@/domain/events/is-event-still-active";

const CULTURAL_RELEVANCE = new Set(["culture", "culture_leisure"]);

/** Plafond court — pas de remplissage artificiel. */
export const WEEKEND_PAGE_SELECTION_LIMIT = 8;

/** Corpus culturel encore actif — avant ranking / plafond. */
export function listCulturalActiveWeekendEvents(
  events: DetourEvent[],
  now: Date,
): DetourEvent[] {
  const classified = events.map((event) => {
    const classification = classifyEventRelevance(event);
    return {
      ...event,
      relevance: classification.relevance,
      relevanceReason: classification.reason,
    };
  });

  const cultural = classified.filter(
    (event) =>
      event.relevance != null && CULTURAL_RELEVANCE.has(event.relevance),
  );
  return filterStillActiveEvents(cultural, now);
}

/**
 * Sélection courte pour `/…/ce-week-end`.
 *
 * Réutilise uniquement des mécanismes déterministes existants :
 * 1. `classifyEventRelevance` (pipeline Home, hors IA)
 * 2. filtre culture / culture_leisure
 * 3. exclusion des événements terminés (`isEventStillActive`)
 * 4. `rankDetourHighlightCandidates` (scores déterministes Home, hors IA / slots)
 *
 * Ne réexécute pas le Radar IA. N’invente pas de scoring dédié.
 * Peut renvoyer moins que `limit` — y compris zéro.
 */
export function selectWeekendPageEvents(
  events: DetourEvent[],
  options: { now: Date; limit?: number },
): DetourEvent[] {
  const limit = options.limit ?? WEEKEND_PAGE_SELECTION_LIMIT;
  if (limit <= 0) return [];

  const active = listCulturalActiveWeekendEvents(events, options.now);
  const ranked = rankDetourHighlightCandidates(active, { now: options.now });

  return ranked.slice(0, limit).map((highlight) => highlight.event);
}
