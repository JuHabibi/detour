import type { DetourEvent } from "@/domain/event";

/**
 * Famille produit Détour (UI / filtres).
 * Indépendante de `relevance` (pertinence culturelle).
 */
export type DetourCategory =
  | "Musique"
  | "Spectacle"
  | "Exposition"
  | "Atelier"
  | "Jeune public"
  | "Rencontre"
  | "Visite"
  | "Loisirs culturels"
  | "Autre";

export const DETOUR_CATEGORIES: DetourCategory[] = [
  "Musique",
  "Spectacle",
  "Exposition",
  "Atelier",
  "Jeune public",
  "Rencontre",
  "Visite",
  "Loisirs culturels",
  "Autre",
];

type Cue = {
  match: string;
  wholeWord?: boolean;
};

/**
 * Priorité V1 (premier match gagne) :
 * Musique → Spectacle → Exposition → Atelier → Jeune public
 * → Rencontre → Visite → Loisirs culturels → Autre
 *
 * Le type de contenu prime sur l’audience
 * (« Concert jeune public » → Musique).
 */
const CATEGORY_PRIORITY: Exclude<DetourCategory, "Autre">[] = [
  "Musique",
  "Spectacle",
  "Exposition",
  "Atelier",
  "Jeune public",
  "Rencontre",
  "Visite",
  "Loisirs culturels",
];

/** Signaux sur category / genre structurés (OpenAgenda). */
const STRUCTURED_SIGNALS: Record<
  Exclude<DetourCategory, "Autre">,
  Cue[]
> = {
  Musique: [
    { match: "musique" },
    { match: "concert" },
    { match: "jazz" },
  ],
  Spectacle: [
    { match: "spectacle" },
    { match: "theatre" },
    { match: "danse", wholeWord: true },
    { match: "danses", wholeWord: true },
    { match: "cirque" },
    { match: "humour" },
    { match: "cinema" },
    { match: "projection" },
  ],
  Exposition: [
    { match: "exposition" },
    { match: "expo", wholeWord: true },
    { match: "photographie" },
  ],
  Atelier: [
    { match: "atelier" },
    { match: "stage" },
    { match: "workshop" },
  ],
  "Jeune public": [
    { match: "jeune public" },
    { match: "famille" },
  ],
  Rencontre: [
    { match: "conference" },
    { match: "rencontre" },
    { match: "debat" },
  ],
  Visite: [
    { match: "visite" },
    { match: "balade" },
    { match: "decouverte" },
    { match: "patrimoine" },
  ],
  "Loisirs culturels": [],
};

/** Signaux title / description / venue (+ category / genre en rattrapage). */
const TEXT_SIGNALS: Record<Exclude<DetourCategory, "Autre">, Cue[]> = {
  Musique: [
    { match: "concert" },
    { match: "musique" },
    { match: "jazz" },
    { match: "orchestre" },
    { match: "chorale" },
    { match: "opera" },
    { match: "philharmonie" },
  ],
  Spectacle: [
    { match: "spectacle" },
    { match: "theatre" },
    { match: "danse", wholeWord: true },
    { match: "danses", wholeWord: true },
    { match: "cirque" },
    { match: "humour" },
    { match: "cinema" },
    { match: "projection" },
  ],
  Exposition: [
    { match: "exposition" },
    { match: "expo", wholeWord: true },
    { match: "photographie" },
    { match: "galerie" },
  ],
  Atelier: [
    { match: "atelier" },
    { match: "workshop" },
    { match: "stage creatif" },
    { match: "scrapbooking" },
    { match: "marqueterie" },
    { match: "pastel" },
  ],
  "Jeune public": [
    { match: "jeune public" },
    { match: "enfants" },
    { match: "petites oreilles" },
    { match: "grandes oreilles" },
    { match: "comptine" },
    { match: "comptines" },
  ],
  Rencontre: [
    { match: "conference" },
    { match: "rencontre" },
    { match: "debat" },
    { match: "table ronde" },
    { match: "dedicace" },
  ],
  Visite: [
    { match: "visite" },
    { match: "balade" },
    { match: "patrimoine" },
    { match: "decouverte" },
  ],
  "Loisirs culturels": [
    { match: "escape game" },
    { match: "realite virtuelle" },
    { match: "vr", wholeWord: true },
    { match: "jeux video" },
    { match: "jeu video" },
    { match: "guinguette" },
    { match: "soiree dansante" },
  ],
};

/**
 * Catégorie produit normalisée — n’altère jamais `relevance`.
 * Agnostique des sources.
 */
export function classifyEventCategory(event: DetourEvent): DetourCategory {
  const structured = normalize(
    [event.category, event.genre].filter(Boolean).join(" "),
  );
  const text = normalize(
    [
      event.category,
      event.genre,
      event.title,
      event.description,
      event.venue,
    ]
      .filter(Boolean)
      .join(" "),
  );

  for (const category of CATEGORY_PRIORITY) {
    if (findCue(structured, STRUCTURED_SIGNALS[category])) {
      return category;
    }
  }

  for (const category of CATEGORY_PRIORITY) {
    if (findCue(text, TEXT_SIGNALS[category])) {
      return category;
    }
  }

  return "Autre";
}

function findCue(text: string, cues: Cue[]): Cue | null {
  if (!text || cues.length === 0) return null;
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
