/**
 * Signaux statiques de classification — données uniquement, aucune logique métier.
 */

export type ClassificationCue = {
  /** Forme normalisée (sans accents) recherchée dans le texte. */
  match: string;
  /** Libellé affiché dans `reason`. */
  label: string;
  /** Si true, ne match que comme mot entier. */
  wholeWord?: boolean;
};

/** Activités récurrentes / inscriptions longues — exclusion prioritaire. */
export const RECURRING_ACTIVITY_SIGNALS: ClassificationCue[] = [
  { match: "cours annuel", label: "cours annuel" },
  { match: "inscription annuelle", label: "inscription annuelle" },
  { match: "atelier annuel", label: "atelier annuel" },
  { match: "adhesion annuelle", label: "adhésion annuelle" },
];

/** Forums / journées d’associations (titre uniquement). */
export const ASSOCIATION_FORUM_TITLE_SIGNALS = [
  "forum des associations",
  "forum des assos",
  "journee des associations",
  "rentree des associations",
] as const;

/** Exclusions structurelles / hors périmètre Détour. */
export const STRONG_EXCLUSION_SIGNALS: ClassificationCue[] = [
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
  { match: "conseil municipal", label: "conseil municipal" },
  { match: "psc1", label: "psc1" },
  { match: "formation psc1", label: "psc1" },
];

/** Sous-chaînes de catégorie → culture. */
export const CULTURE_CATEGORY_SIGNALS: ClassificationCue[] = [
  { match: "musique", label: "musique" },
  { match: "spectacle", label: "spectacle" },
  { match: "exposition", label: "exposition" },
  { match: "expo", label: "exposition", wholeWord: true },
  { match: "projection", label: "projection-cinéma" },
  { match: "cinema", label: "projection-cinéma" },
];

/** Catégorie sport → exclusion. */
export const SPORT_CATEGORY_SIGNALS = ["sport"] as const;

/** Catégories balade / visite → culture_leisure. */
export const LEISURE_CATEGORY_SIGNALS = [
  "balade",
  "decouverte",
  "visite",
] as const;

/** Catégories ambiguës → uncertain (si aucun autre signal). */
export const AMBIGUOUS_CATEGORY_SIGNALS = [
  "jeune public",
  "stage",
  "atelier",
  "conference",
  "rencontre",
  "debat",
  "fete",
  "salon",
  "marche",
] as const;

/**
 * Contenu culturel clair (title / description / category…).
 * Pas les seuls noms de lieux — ceux-ci sont en CULTURE_VENUE_SIGNALS.
 */
export const CULTURE_TEXT_SIGNALS: ClassificationCue[] = [
  { match: "concert", label: "concert" },
  { match: "musique", label: "musique" },
  { match: "jazz", label: "jazz" },
  { match: "theatre", label: "théâtre" },
  { match: "cinema", label: "cinéma" },
  { match: "projection", label: "projection" },
  { match: "exposition", label: "exposition" },
  { match: "expo", label: "expo", wholeWord: true },
  { match: "design", label: "design" },
  { match: "artiste", label: "artiste" },
  { match: "danse", label: "danse", wholeWord: true },
  { match: "danses", label: "danse", wholeWord: true },
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
  { match: "comptine", label: "comptine" },
  {
    match: "histoires pour les petites oreilles",
    label: "histoires petites oreilles",
  },
  {
    match: "histoires pour les grandes oreilles",
    label: "histoires grandes oreilles",
  },
];

/**
 * Lieux culturels — signal faible (après contenu culture et leisure).
 * Un lieu ne bat jamais une exclusion ni un loisir explicite.
 */
export const CULTURE_VENUE_SIGNALS: ClassificationCue[] = [
  { match: "mediatheque", label: "médiathèque" },
  { match: "bibliotheque", label: "bibliothèque" },
  { match: "maison des loisirs et de la culture", label: "MLC" },
  { match: "maisons des loisirs et de la culture", label: "MLC" },
  { match: "mjc", label: "MJC", wholeWord: true },
];

/** Loisirs culturels / médiation ludique. */
export const LEISURE_TEXT_SIGNALS: ClassificationCue[] = [
  { match: "guinguette", label: "guinguette" },
  { match: "soiree dansante", label: "soirée dansante" },
  { match: "scrapbooking", label: "scrapbooking" },
  { match: "marqueterie", label: "marqueterie" },
  { match: "pastel", label: "pastel" },
  { match: "escape game", label: "escape game" },
  { match: "realite virtuelle", label: "réalité virtuelle" },
  { match: "vr", label: "VR", wholeWord: true },
  { match: "jeux video", label: "jeux vidéo" },
  { match: "jeu video", label: "jeu vidéo" },
];
