import type { DetourEvent } from "@/domain/events/event";

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

  // Override local Musique↔Spectacle (tags concert) — sans inverser STRUCTURED_PRIORITY.
  // Title+description seuls pour les cues « spectacle vivant » : un venue
  // « Théâtre … » ne doit pas bloquer un vrai concert.
  const titleDescription = normalize(
    [event.title, event.description].filter(Boolean).join(" "),
  );
  const concertPrimary = classifyConcertPrimaryFromSourceTags(
    event.category,
    titleDescription,
    text,
  );
  if (concertPrimary) return concertPrimary;

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

/**
 * Reclassement ciblé des concerts mal orientés vers Spectacle.
 *
 * - `Spectacle / Concert` → Musique sauf spectacle vivant clairement dominant ;
 * - paire exacte `Musique;Spectacle` / `Spectacle;Musique` → Musique si
 *   l’activité principale est un concert (pas impro+concert, pas spectacle chanté) ;
 * - dumps Passerelle (≥3 tags) : aucun override.
 *
 * @param titleDescription — title + description (cues vivant / hybrid)
 * @param fullText — title + description + venue (cues musique)
 */
function classifyConcertPrimaryFromSourceTags(
  categoryRaw: string | null | undefined,
  titleDescription: string,
  fullText: string,
): "Musique" | null {
  const tags = splitSourceTags(categoryRaw);
  if (tags.length === 0) return null;

  if (tags.length === 1 && isSpectacleConcertTag(tags[0])) {
    // Tag Bouillon « Concert » : Musique sauf théâtre / danse / cirque / impro.
    if (hasSpectacleLivingOrHybridCue(titleDescription)) return null;
    return "Musique";
  }

  if (tags.length === 2 && isMusiqueSpectaclePair(tags)) {
    if (hasSpectacleLivingOrHybridCue(titleDescription)) return null;
    return hasMusicalPerformanceCue(fullText) ? "Musique" : null;
  }

  return null;
}

function splitSourceTags(category: string | null | undefined): string[] {
  if (!category?.trim()) return [];
  return category
    .split(";")
    .map((part) => normalize(part))
    .filter(Boolean);
}

function isSpectacleConcertTag(tag: string): boolean {
  return (
    tag === "spectacle / concert" ||
    tag === "spectacle/concert" ||
    tag === "concert / spectacle"
  );
}

function isMusiqueSpectaclePair(tags: string[]): boolean {
  if (tags.length !== 2) return false;
  const set = new Set(tags);
  return set.has("musique") && set.has("spectacle");
}

/** Concert / performance musicale primaire (texte déjà normalisé). */
function hasMusicalPerformanceCue(text: string): boolean {
  if (!text) return false;
  if (findCue(text, TEXT_SIGNALS.Musique)) return true;
  return (
    /\b(duo|trio|quintette|recital|live)\b/.test(text) ||
    /\b(folk|chanson|chansons|cuivres|flute|guitare)\b/.test(text) ||
    /voyage musical/.test(text) ||
    /radio[-\s]?crochet/.test(text)
  );
}

/**
 * Spectacle vivant / hybride qui doit rester Spectacle malgré un tag Musique.
 * (impro+concerts, comédie musicale, ballet, spectacle chanté narratif…)
 * Texte = title + description (pas le venue).
 *
 * Cues volontiers strictes : « humour » / « théâtre » seuls apparaissent
 * souvent dans des bios de concerts sans en faire un spectacle vivant.
 */
function hasSpectacleLivingOrHybridCue(text: string): boolean {
  if (!text) return false;
  if (
    /comedie musicale|theatre musical|ballet|stand-?up|theatre d[' ]impro|impro et concert|theatral|centre dramatique|piece de theatre|mise en scene|seul-?en-?scene|one-?man.?show|one-?woman.?show|cabaret radiophonique|radiophonique/.test(
      text,
    )
  ) {
    return true;
  }
  // Conte / récit scénique (ex. performance hybride chant+danse).
  if (/\bconte\b/.test(text)) return true;
  // Compagnie théâtrale (titre/desc), pas un simple « vient du théâtre ».
  if (/\bcie\b/.test(text) || /compagnie/.test(text)) return true;
  // Théâtre comme forme : « au théâtre », « théâtre d'… », pas la bio « du théâtre ».
  if (/theatre d[' ]/.test(text) || /\b(au|de) theatre\b/.test(text)) {
    return true;
  }
  return Boolean(
    findCue(text, [
      { match: "danse", wholeWord: true },
      { match: "danses", wholeWord: true },
      { match: "danseur", wholeWord: true },
      { match: "danseurs", wholeWord: true },
      { match: "danseuse", wholeWord: true },
      { match: "danseuses", wholeWord: true },
      { match: "cirque" },
      { match: "acrobat" },
      { match: "impro", wholeWord: true },
    ]),
  );
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
