import type { DetourEvent, EventRelevance } from "@/domain/event";

export type EventClassification = {
  relevance: EventRelevance;
  reason: string;
};

type Cue = {
  /** Forme normalisée (sans accents) recherchée dans le texte. */
  match: string;
  /** Libellé affiché dans `reason`. */
  label: string;
  /** Si true, ne match que comme mot entier. */
  wholeWord?: boolean;
};

/** Indices textuels clairement culturels. */
const CULTURE_CUES: Cue[] = [
  { match: "concert", label: "concert" },
  { match: "musique", label: "musique" },
  { match: "jazz", label: "jazz" },
  { match: "theatre", label: "théâtre" },
  { match: "cinema", label: "cinéma" },
  { match: "projection", label: "projection" },
  { match: "exposition", label: "exposition" },
  // "expo" uniquement en mot complet — évite les faux positifs (ex. sous-chaînes).
  { match: "expo", label: "expo", wholeWord: true },
  { match: "design", label: "design" },
  { match: "artiste", label: "artiste" },
  { match: "danse", label: "danse" },
  { match: "lecture", label: "lecture" },
  { match: "litterature", label: "littérature" },
  { match: "musee", label: "musée" },
  { match: "patrimoine", label: "patrimoine" },
  { match: "spectacle", label: "spectacle" },
  { match: "festival", label: "festival" },
  { match: "photographie", label: "photographie" },
  { match: "ecriture", label: "écriture" },
  { match: "creation", label: "création" },
  { match: "philharmonie", label: "philharmonie" },
  { match: "orchestre", label: "orchestre" },
  { match: "opera", label: "opéra" },
  { match: "chorale", label: "chorale" },
  { match: "batterie", label: "batterie" },
];

/** Exclusions structurelles / activités hors périmètre. */
const EXCLUDED_KEYWORDS: Cue[] = [
  { match: "soutien numerique", label: "soutien numérique" },
  { match: "zumba", label: "zumba" },
  { match: "qi gong", label: "qi gong" },
  { match: "qigong", label: "qi gong" },
  { match: "marche nordique", label: "marche nordique" },
  { match: "don de sang", label: "don de sang" },
  { match: "free fit", label: "free fit" },
  { match: "yoga nidra", label: "yoga" },
  { match: "hatha yoga", label: "yoga" },
  { match: "yoga", label: "yoga" },
];

/** Forums / journées d’associations — hors périmètre Détour. */
const ASSOCIATION_FORUM_TITLE_CUES = [
  "forum des associations",
  "forum des assos",
  "journee des associations",
  "rentree des associations",
] as const;
/**
 * Activité récurrente / inscription longue.
 * Prioritaire même face à une catégorie ou un mot culturel fort.
 */
const RECURRING_ACTIVITY_CUES: Cue[] = [
  { match: "cours annuel", label: "cours annuel" },
  { match: "inscription annuelle", label: "inscription annuelle" },
  { match: "atelier annuel", label: "atelier annuel" },
  { match: "adhesion annuelle", label: "adhésion annuelle" },
];

/**
 * Classification culturelle Détour.
 * Ordre : exclusions structurelles → catégories fortes → mots culturels
 * → loisirs/contextuels → uncertain.
 */
export function classifyEventRelevance(
  event: DetourEvent,
): EventClassification {
  const category = normalize(event.category);
  const text = buildSearchText(event);

  // A. Exclusions structurelles fortes (battent les signaux culturels).
  const recurring = findCue(text, RECURRING_ACTIVITY_CUES);
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

  const excludedKeyword = findCue(text, EXCLUDED_KEYWORDS);
  if (excludedKeyword) {
    return {
      relevance: "out_of_scope",
      reason: `excluded-keyword:${excludedKeyword.label}`,
    };
  }

  if (isSportCategory(category)) {
    return {
      relevance: "out_of_scope",
      reason: "excluded-category:sport",
    };
  }

  // B. Catégories culturelles fortes.
  const strongCategory = detectStrongCultureCategory(category);
  if (strongCategory) {
    return {
      relevance: "culture",
      reason: `strong-category:${strongCategory}`,
    };
  }

  // C. Signaux textuels culturels.
  const cultureKeyword = findCue(text, CULTURE_CUES);
  if (cultureKeyword) {
    return {
      relevance: "culture",
      reason: `cultural-keyword:${cultureKeyword.label}`,
    };
  }

  // D. Catégories loisirs / contextuelles.
  if (isWalkVisitCategory(category)) {
    return {
      relevance: "culture_leisure",
      reason: "leisure-category:balade",
    };
  }

  if (isYoungAudienceCategory(category) || isAmbiguousCategory(category)) {
    return {
      relevance: "uncertain",
      reason: "ambiguous-category",
    };
  }

  // E. Aucun signal exploitable.
  return {
    relevance: "uncertain",
    reason: "no-signal",
  };
}

function buildSearchText(event: DetourEvent): string {
  return normalize(
    [event.category, event.title, event.description, event.source, event.conditions]
      .filter(Boolean)
      .join(" "),
  );
}

function detectStrongCultureCategory(category: string): string | null {
  if (!category) return null;
  if (category.includes("musique")) return "musique";
  if (category.includes("spectacle")) return "spectacle";
  if (category.includes("exposition") || /\bexpo\b/.test(category)) {
    return "exposition";
  }
  if (category.includes("projection") || category.includes("cinema")) {
    return "projection-cinéma";
  }
  return null;
}

function isYoungAudienceCategory(category: string): boolean {
  return category.includes("jeune public");
}

function isWalkVisitCategory(category: string): boolean {
  return (
    category.includes("balade") ||
    category.includes("decouverte") ||
    category.includes("visite")
  );
}

function isAmbiguousCategory(category: string): boolean {
  if (!category) return false;
  if (category.includes("stage") || category.includes("atelier")) return true;
  if (
    category.includes("conference") ||
    category.includes("rencontre") ||
    category.includes("debat")
  ) {
    return true;
  }
  if (
    category.includes("fete") ||
    category.includes("salon") ||
    category.includes("marche")
  ) {
    return true;
  }
  return false;
}

function isSportCategory(category: string): boolean {
  return category.includes("sport");
}

function isAssociationsForumTitle(title: string | null): boolean {
  const normalizedTitle = normalize(title);
  if (!normalizedTitle) return false;
  return ASSOCIATION_FORUM_TITLE_CUES.some((cue) =>
    normalizedTitle.includes(cue),
  );
}

function isSeasonEnrollment(text: string): boolean {
  if (!/saison\s+20\d{2}\s*[-/]\s*20\d{2}/.test(text)) {
    return false;
  }

  const enrollmentHints = [
    "inscription",
    "cours",
    "adhesion",
    "essai",
  ];

  return enrollmentHints.some((hint) => text.includes(hint));
}

function findCue(text: string, cues: Cue[]): Cue | null {
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
