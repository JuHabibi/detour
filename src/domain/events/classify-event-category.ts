import type { DetourEvent } from "@/domain/events/event";

/**
 * Famille produit Détour (UI / filtres).
 * Indépendante de `relevance` (pertinence culturelle).
 */
export type DetourCategory =
  | "Musique"
  | "Spectacle"
  | "Cinéma"
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
  "Cinéma",
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
 * Fête → Spectacle → Exposition → Atelier → Cinéma → Jeune public
 * → Rencontre → Visite → Musique → Loisirs culturels
 *
 * Ordre Spectacle → Atelier inchangé (Passerelle / PR-A).
 * Les projections sont surtout tranchées par `classifyCinemaPrimary` (avant boucle).
 */
const STRUCTURED_PRIORITY: ProductCategory[] = [
  "Fête / salon / marché",
  "Spectacle",
  "Exposition",
  "Atelier",
  "Cinéma",
  "Jeune public",
  "Rencontre",
  "Visite",
  "Musique",
  "Loisirs culturels",
];

/**
 * Priorité textuelle (title / description / venue) si pas de signal structuré :
 * Musique → Cinéma → Spectacle → Exposition → Atelier → Jeune public
 * → Rencontre → Visite → Fête → Loisirs → Autre
 *
 * Contenu > audience (« Concert jeune public » → Musique).
 */
const TEXT_PRIORITY: ProductCategory[] = [
  "Musique",
  "Cinéma",
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
  Cinéma: [
    { match: "cinema" },
    { match: "projection" },
  ],
  Spectacle: [
    { match: "spectacle" },
    { match: "theatre" },
    { match: "danse", wholeWord: true },
    { match: "danses", wholeWord: true },
    { match: "cirque" },
    { match: "humour" },
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
  Cinéma: [
    { match: "cinema" },
    { match: "projection" },
    { match: "seance cinema" },
    { match: "film d animation" },
    { match: "film d'animation" },
    { match: "mois du film" },
    { match: "mois du doc" },
  ],
  Spectacle: [
    { match: "spectacle" },
    { match: "theatre" },
    { match: "danse", wholeWord: true },
    { match: "danses", wholeWord: true },
    { match: "cirque" },
    { match: "humour" },
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

  // Captation d’art vivant projetée (opéra, etc.) → Spectacle, pas Cinéma.
  if (isProjectedPerformingArtsCapture(titleDescription)) {
    return "Spectacle";
  }

  // Projection explicite de concert (ex. Philharmonie) → Musique, pas Cinéma.
  if (isProjectedConcertCapture(titleDescription)) {
    return "Musique";
  }

  // Balade / visite + projection secondaire → Visite (pas Cinéma).
  if (isVisitWithSecondaryProjection(structured)) {
    return "Visite";
  }

  // Projections / CINÉ-VACANCES avant STRUCTURED_PRIORITY (sinon « Spectacle »
  // ou l’absence de cue laisse CINÉ-VACANCES en Autre).
  const cinemaPrimary = classifyCinemaPrimary(
    event.category,
    structured,
    titleDescription,
  );
  if (cinemaPrimary) return cinemaPrimary;

  if (isMusicalPerformanceWithExhibitionTags(event)) return "Musique";

  if (structured) {
    for (const category of STRUCTURED_PRIORITY) {
      if (findCue(structured, STRUCTURED_SIGNALS[category])) {
        return category;
      }
    }
  }

  for (const category of TEXT_PRIORITY) {
    if (category === "Cinéma") {
      // Garde-fou : stage / atelier / quizz « cinéma » ≠ séance de projection.
      // Stem « cine » borné (évite « piscine ») ; title+desc seulement.
      if (
        !isCinemaWorkshopOrQuizText(titleDescription) &&
        !isProjectedPerformingArtsCapture(titleDescription) &&
        !isProjectedConcertCapture(titleDescription) &&
        (findCue(titleDescription, TEXT_SIGNALS.Cinéma) ||
          hasCinemaStem(titleDescription))
      ) {
        return "Cinéma";
      }
      continue;
    }
    if (findCue(text, TEXT_SIGNALS[category])) {
      return category;
    }
  }

  return "Autre";
}

/**
 * Séances de cinéma / documentaire / CINÉ-VACANCES.
 * N’empiète pas sur atelier+projection ni sur les dumps Passerelle.
 */
function classifyCinemaPrimary(
  categoryRaw: string | null | undefined,
  structured: string,
  titleDescription: string,
): "Cinéma" | null {
  if (isCinemaWorkshopOrQuizText(titleDescription)) return null;
  if (isProjectedPerformingArtsCapture(titleDescription)) return null;
  if (isProjectedConcertCapture(titleDescription)) return null;
  if (isVisitWithSecondaryProjection(structured)) return null;
  // Expo structurée + projection : l’exposition prime (journée expo / lectures).
  if (findCue(structured, STRUCTURED_SIGNALS.Exposition)) return null;
  if (
    findCue(structured, [
      { match: "atelier" },
      { match: "stage" },
      { match: "workshop" },
    ])
  ) {
    return null;
  }

  if (
    findCue(structured, STRUCTURED_SIGNALS.Cinéma) ||
    hasCinemaStem(structured)
  ) {
    return "Cinéma";
  }

  // Tag source « Spectacle » seul alors que le texte décrit une séance.
  const tags = splitSourceTags(categoryRaw);
  if (
    tags.length === 1 &&
    tags[0] === "spectacle" &&
    hasStrongCinemaScreeningText(titleDescription)
  ) {
    return "Cinéma";
  }

  return null;
}

/** Stage / atelier / quizz autour du cinéma — pas une séance de projection. */
function isCinemaWorkshopOrQuizText(titleDescription: string): boolean {
  if (!titleDescription) return false;
  if (/\b(stage|atelier|workshop|quizz?|doublage)\b/.test(titleDescription)) {
    return true;
  }
  return /histoire du cinema|cine quizz|mode cine/.test(titleDescription);
}

/**
 * Captation d’art vivant diffusée sur écran (opéra, théâtre filmé…).
 * Reste Spectacle même si le tag source dit « Projection - cinéma ».
 * « captation » seul ne suffit pas : il faut un indice d’art vivant.
 */
function isProjectedPerformingArtsCapture(text: string): boolean {
  if (!text) return false;
  if (/theatre filme|spectacle lyrique/.test(text)) return true;
  const hasLiveArts =
    /\bopera\b/.test(text) ||
    /\btheatre\b/.test(text) ||
    /\bballet\b/.test(text);
  const hasScreenOrCapture =
    /\bprojection\b/.test(text) ||
    /\bfilme\b/.test(text) ||
    /\becran\b/.test(text) ||
    /\bcaptation\b/.test(text);
  return hasLiveArts && hasScreenOrCapture;
}

/**
 * Projection / diffusion enregistrée d’une performance musicale → Musique.
 *
 * Critères (tous nécessaires, formulés en locutions liées) :
 * 1. preuve explicite de projection / captation / diffusion enregistrée ;
 * 2. preuve explicite que le contenu est un concert / récital ;
 * 3. sinon : ne pas forcer Musique (laisser Cinéma ou le reste du classifieur).
 *
 * Agnostique des lieux, institutions, artistes, titres et styles.
 */
function isProjectedConcertCapture(text: string): boolean {
  if (!text) return false;
  // « projection(s) de concert(s|récital…) »
  if (/projections? de (concerts?|recitals?)/.test(text)) return true;
  // « captation (de / d’un) concert|récital »
  if (
    /captations? (de |d[' ](?:un |une )?)?(concerts?|recitals?)/.test(text)
  ) {
    return true;
  }
  // « concert|récital filmé / projeté / en captation / enregistré »
  if (
    /(concerts?|recitals?) (filmes?|projetes?|en captation|enregistres?)/.test(
      text,
    )
  ) {
    return true;
  }
  // « diffusion (de / d’un) concert|récital »
  if (
    /diffusions? (de |d[' ](?:un |une )?)?(concerts?|recitals?)/.test(text)
  ) {
    return true;
  }
  return false;
}

/** Tags visite/balade + projection : la balade prime. */
function isVisitWithSecondaryProjection(structured: string): boolean {
  if (!structured) return false;
  const hasVisit = findCue(structured, STRUCTURED_SIGNALS.Visite);
  const hasCinema =
    findCue(structured, STRUCTURED_SIGNALS.Cinéma) || hasCinemaStem(structured);
  return Boolean(hasVisit && hasCinema);
}

/**
 * Preuve de séance (pas une simple mention « inspirée du cinéma »).
 * Utilisé seulement pour surclasser un tag source « Spectacle » seul.
 */
function hasStrongCinemaScreeningText(text: string): boolean {
  if (!text) return false;
  return /seance cinema|film d[' ]?animation|\bprojection\b|mois du (film|doc)|cine-?seniors|cine-?debat|cine-?vacances|cine etc/.test(
    text,
  );
}

/**
 * Stem « cine » en début de token (cinema, ciné-vacances, CinéEtc).
 * N’accroche pas « piscine ».
 */
function hasCinemaStem(text: string): boolean {
  if (!text) return false;
  return /(^|[^a-z0-9])cine/.test(text);
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

/**
 * Paire Exposition + Musique : départager uniquement avec une forme musicale
 * explicite dans le titre. Une description / un lieu musical ne suffit pas.
 * Le contexte d’exposition peut rester dans la description (dévernissage).
 * Les programmes mixtes et les autres combinaisons gardent leur priorité.
 */
function isMusicalPerformanceWithExhibitionTags(event: DetourEvent): boolean {
  const tags = splitSourceTags(
    [event.category, event.genre].filter(Boolean).join(";"),
  );
  if (
    tags.length !== 2 ||
    !tags.includes("exposition") ||
    !tags.includes("musique")
  ) {
    return false;
  }

  const title = normalize(event.title);
  // Une expo sur des concerts, un programme vernissage + concert, une projection
  // ou un atelier ne doivent pas être promus sur le seul mot « concert ».
  if (
    /\b(expositions?|expos?|vernissages?|devernissages?|photograph[a-z]*|retrospectives?|installations?|projections?|captations?|films?|ateliers?|stages?|conferences?|visites?)\b/.test(title) ||
    hasSpectacleLivingOrHybridCue(title)
  ) {
    return false;
  }

  // Forme annoncée en tête de titre / sous-titre, pas une mention thématique
  // telle que « Histoire du concert ». Aucune dépendance à un nom d’artiste.
  return title.split(/[:(–—]/).some((part) => {
    const heading = part.trim();
    if (/^(?:mini[- ]?)?(concerts?|recitals?)\b/.test(heading)) return true;
    // Instrument explicite : « solo » seul peut aussi décrire danse ou peinture.
    return /^solo (?:de |d['’]|pour )(?:oud|piano|guitare|violon|violoncelle|flute|clarinette|saxophone|orgue|harpe|percussions?|accordeon|contrebasse|batterie|trompette)\b/.test(heading);
  });
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
