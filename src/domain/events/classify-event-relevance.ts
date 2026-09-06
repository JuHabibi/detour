import type { DetourEvent, EventRelevance } from "@/domain/events/event";
import {
  AMBIGUOUS_CATEGORY_SIGNALS,
  ASSOCIATION_FORUM_TITLE_SIGNALS,
  CULTURE_CATEGORY_SIGNALS,
  CULTURE_TEXT_SIGNALS,
  CULTURE_VENUE_SIGNALS,
  LEISURE_CATEGORY_SIGNALS,
  LEISURE_TEXT_SIGNALS,
  RECURRING_ACTIVITY_SIGNALS,
  SPORT_CATEGORY_SIGNALS,
  STRONG_EXCLUSION_SIGNALS,
  type ClassificationCue,
} from "@/domain/events/event-classification-signals";

export type EventClassification = {
  relevance: EventRelevance;
  reason: string;
};

/**
 * Classification culturelle Détour (agnostique des sources).
 *
 * Priorité :
 * 1. exclusions fortes
 * 2. catégories culture structurées
 * 3. texte culture (contenu)
 * 4. texte culture_leisure
 * 5. lieux culturels (signal faible)
 * 6. catégories leisure / ambiguës
 * 7. uncertain
 */
export function classifyEventRelevance(
  event: DetourEvent,
): EventClassification {
  const category = normalize(event.category);
  const text = buildContentText(event);
  const placeText = buildPlaceText(event);

  // 1. Exclusions fortes (battent lieux et mots culturels).
  const recurring = findCue(text, RECURRING_ACTIVITY_SIGNALS);
  if (recurring) {
    return {
      relevance: "out_of_scope",
      reason: `recurring-activity:${recurring.label}`,
    };
  }

  if (isSeasonEnrollment(text)) {
    return {
      relevance: "out_of_scope",
      reason: "recurring-activity:saison-inscription",
    };
  }

  if (isAssociationsForumTitle(event.title)) {
    return {
      relevance: "out_of_scope",
      reason: "excluded-event-type:associations-forum",
    };
  }

  const excludedKeyword = findCue(text, STRONG_EXCLUSION_SIGNALS);
  if (excludedKeyword) {
    return {
      relevance: "out_of_scope",
      reason: `excluded-keyword:${excludedKeyword.label}`,
    };
  }

  if (matchesAnySubstring(category, SPORT_CATEGORY_SIGNALS)) {
    return {
      relevance: "out_of_scope",
      reason: "excluded-category:sport",
    };
  }

  // 2. Catégories culturelles structurées.
  const strongCategory = findCue(category, CULTURE_CATEGORY_SIGNALS);
  if (strongCategory) {
    return {
      relevance: "culture",
      reason: `strong-category:${strongCategory.label}`,
    };
  }

  // 3. Contenu culturel textuel.
  const cultureKeyword = findCue(text, CULTURE_TEXT_SIGNALS);
  if (cultureKeyword) {
    return {
      relevance: "culture",
      reason: `cultural-keyword:${cultureKeyword.label}`,
    };
  }

  // 4. Loisirs culturels (avant le seul signal lieu).
  const leisureKeyword = findCue(text, LEISURE_TEXT_SIGNALS);
  if (leisureKeyword) {
    return {
      relevance: "culture_leisure",
      reason: `leisure-keyword:${leisureKeyword.label}`,
    };
  }

  // 5. Lieux culturels — signal, pas vérité absolue.
  const venueSignal = findCue(placeText, CULTURE_VENUE_SIGNALS);
  if (venueSignal) {
    return {
      relevance: "culture",
      reason: `cultural-venue:${venueSignal.label}`,
    };
  }

  // 6. Catégories leisure / ambiguës.
  if (matchesAnySubstring(category, LEISURE_CATEGORY_SIGNALS)) {
    return {
      relevance: "culture_leisure",
      reason: "leisure-category:balade",
    };
  }

  if (matchesAnySubstring(category, AMBIGUOUS_CATEGORY_SIGNALS)) {
    return {
      relevance: "uncertain",
      reason: "ambiguous-category",
    };
  }

  // 7. Aucun signal exploitable.
  return {
    relevance: "uncertain",
    reason: "no-signal",
  };
}

/** Texte de contenu (sans venue) — préserve le matching historique. */
function buildContentText(event: DetourEvent): string {
  return normalize(
    [
      event.category,
      event.title,
      event.description,
      event.source,
      event.conditions,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** Lieu + titre (noms de structures souvent dans le titre iCal). */
function buildPlaceText(event: DetourEvent): string {
  return normalize([event.venue, event.title].filter(Boolean).join(" "));
}

function isAssociationsForumTitle(title: string | null): boolean {
  const normalizedTitle = normalize(title);
  if (!normalizedTitle) return false;
  return ASSOCIATION_FORUM_TITLE_SIGNALS.some((cue) =>
    normalizedTitle.includes(cue),
  );
}

function isSeasonEnrollment(text: string): boolean {
  if (!/saison\s+20\d{2}\s*[-/]\s*20\d{2}/.test(text)) {
    return false;
  }

  return ["inscription", "cours", "adhesion", "essai"].some((hint) =>
    text.includes(hint),
  );
}

function matchesAnySubstring(
  text: string,
  signals: readonly string[],
): boolean {
  if (!text) return false;
  return signals.some((signal) => text.includes(signal));
}

function findCue(
  text: string,
  cues: ClassificationCue[],
): ClassificationCue | null {
  if (!text) return null;
  for (const cue of cues) {
    if (cue.wholeWord) {
      if (hasWholeWord(text, cue.match)) return cue;
      continue;
    }
    if (text.includes(cue.match)) return cue;
  }
  return null;
}

function hasWholeWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
