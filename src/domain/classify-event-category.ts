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
  | "Fête / salon / marché"
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
  "Fête / salon / marché",
  "Loisirs culturels",
  "Autre",
];

type Cue = {
  match: string;
  wholeWord?: boolean;
};

type ProductCategory = Exclude<DetourCategory, "Autre">;

/**
 * Priorité sur champs structurés (category / genre) :
 * Fête → Spectacle → Exposition → Atelier → Jeune public
 * → Rencontre → Visite → Musique → Loisirs culturels
 *
 * « Fête - salon - marché;Musique » → Fête / salon / marché
 * (le type d’événement structurel prime sur le tag secondaire).
 */
const STRUCTURED_PRIORITY: ProductCategory[] = [
  "Fête / salon / marché",
  "Spectacle",
  "Exposition",
  "Atelier",
  "Jeune public",
  "Rencontre",
  "Visite",
  "Musique",
  "Loisirs culturels",
];

/**
 * Priorité textuelle (title / description / venue) si pas de signal structuré :
 * Musique → Spectacle → Exposition → Atelier → Jeune public
 * → Rencontre → Visite → Fête → Loisirs → Autre
 *
 * Contenu > audience (« Concert jeune public » → Musique).
 */
const TEXT_PRIORITY: ProductCategory[] = [
  "Musique",
  "Spectacle",
  "Exposition",
  "Atelier",
  "Jeune public",
  "Rencontre",
  "Visite",
  "Fête / salon / marché",
  "Loisirs culturels",
];

/** Signaux sur category / genre structurés. */
const STRUCTURED_SIGNALS: Record<ProductCategory, Cue[]> = {
  "Fête / salon / marché": [
    { match: "fete" },
    { match: "salon" },
    { match: "marche" },
  ],
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

/** Signaux title / description / venue. */
const TEXT_SIGNALS: Record<ProductCategory, Cue[]> = {
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
  "Fête / salon / marché": [
    { match: "fete" },
    { match: "salon" },
    { match: "marche", wholeWord: true },
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
 * Catégorie produit normalisée — indépendante de `relevance`.
 * Agnostique des sources.
 */
export function classifyEventCategory(event: DetourEvent): DetourCategory {
  const structured = normalize(
    [event.category, event.genre].filter(Boolean).join(" "),
  );
  const text = normalize(
    [event.title, event.description, event.venue].filter(Boolean).join(" "),
  );

  if (structured) {
    for (const category of STRUCTURED_PRIORITY) {
      if (findCue(structured, STRUCTURED_SIGNALS[category])) {
        return category;
      }
    }
  }

  for (const category of TEXT_PRIORITY) {
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
