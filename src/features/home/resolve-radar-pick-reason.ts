import type { EventItem } from "@/data/types";
import { getRadarPickReasonOverride } from "@/features/home/radar-pick-reason-overrides";

/** Longueur cible d’une phrase carte (line-clamp-2). */
const MAX_REASON_LENGTH = 120;

/**
 * Affirmations d’urgence / rareté commerciale interdites sans preuve source.
 * Une simple proximité de date ne doit jamais produire ces formulations.
 */
const FORBIDDEN_URGENCY =
  /places limitées|derni[eè]re chance|r[eé]servation obligatoire|unique repr[eé]sentation|bient[oô]t complet|presque complet|derni[eè]res places|vite complet|urgence/i;

/** Codes machine / labels trop génériques — jamais publiés tels quels. */
const MACHINE_OR_GENERIC_REASON =
  /^(singular|local-discovery|local discovery|high-appeal|headline-appeal|booking-available|billetterie|booking|reservation|ok|test)$/i;

/**
 * Raisons qui ne font que répéter lieu / commune / billetterie / gratuité.
 * Inutiles éditorialement sur une carte qui affiche déjà ces infos.
 */
const SHALLOW_PRACTICAL_REASON =
  /^(programm[eé]e?\s+[àa]\s+\w|dans (un |une )?(lieu|salle|commune|ville)|billetterie|inscription disponible|r[eé]servation disponible|entr[eé]e gratuite|sur inscription|gratuit(\.?)$)/i;

const STOPWORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "cet",
  "cette",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "la",
  "le",
  "les",
  "ou",
  "pour",
  "par",
  "un",
  "une",
  "sur",
  "qui",
  "que",
  "d",
  "l",
  "est",
  "sont",
  "plus",
  "apres",
  "après",
  "entre",
  "vers",
  "chez",
  "se",
  "sa",
  "son",
  "ses",
]);

/**
 * Indices de contenu / format / singularité / échéance réelle.
 * Sans l’un de ceux-ci, une reason reste trop « méta » pour l’encart.
 */
const EDITORIAL_SUBSTANCE =
  /th[eé][aâ]tre|concert|spectacle|exposition|expo|cin[eé]ma|projection|festival|danse|chor[eé]graph|humour|performance|r[eé]sidence|premi[eè]re|enregistrement|album|live|cd\b|sms|loto|paper|papier|improvis|quiz|atelier|lecture|conf[eé]rence|op[eé]ra|orchestre|jazz|blues|ragtime|participation|dispositif|cr[eé]ation|compagnie|duo|trio|quatuor|film|documentaire|inscription avant|date limite|derni[eè]re (?:repr[eé]sentation|s[eé]ance)|sortie de r[eé]sidence|hors[- ]les[- ]murs|jeune public|th[eé][aâ]tre de papier/i;

/**
 * Phrase courte « LE REGARD DÉTOUR » (modale Radar).
 * Retourne null si aucune justification informative et vérifiable.
 *
 * Priorité :
 * 1. reason IA factuelle, concrète et étayée par la fiche
 * 2. override éditorial manuel temporaire (id stable) — test utilisateur
 * 3. sinon null (bloc masqué)
 *
 * Ne publie jamais `relevanceReason` (clé machine de classification).
 * Pas de fallback ville / lieu / billetterie / gratuité / badge générique.
 */
export function resolveRadarPickReason(event: EventItem): string | null {
  const fromAi = pickPublishableAiReason(event);
  if (fromAi) return fromAi;

  return getRadarPickReasonOverride(event.id);
}

function pickPublishableAiReason(event: EventItem): string | null {
  const reasons = event.radarAiReasons;
  if (!reasons?.length) return null;

  const sourceCorpus = buildSourceCorpus(event);

  for (const raw of reasons) {
    const cleaned = sanitizeReasonText(raw);
    if (!cleaned) continue;
    if (MACHINE_OR_GENERIC_REASON.test(cleaned)) continue;
    if (FORBIDDEN_URGENCY.test(cleaned)) continue;
    if (SHALLOW_PRACTICAL_REASON.test(cleaned)) continue;
    if (cleaned.length < 24) continue;
    if (!hasEditorialSubstance(cleaned)) continue;
    if (!isGroundedInSource(cleaned, sourceCorpus)) continue;
    return truncateReason(cleaned);
  }

  return null;
}

function buildSourceCorpus(event: EventItem): string {
  return normalize(
    [
      event.title,
      event.description,
      event.conditions,
      event.venue,
      event.city,
      event.genre,
      event.sourceCategory,
      event.category === "tout" ? "" : event.category,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function hasEditorialSubstance(reason: string): boolean {
  return EDITORIAL_SUBSTANCE.test(reason);
}

/**
 * La reason doit être traçable dans la fiche : assez de tokens significatifs
 * présents dans titre / description / conditions / lieu / catégorie.
 */
function isGroundedInSource(reason: string, sourceCorpus: string): boolean {
  if (!sourceCorpus) return false;

  const tokens = tokenize(reason).filter(
    (token) => token.length >= 4 && !STOPWORDS.has(token),
  );
  if (tokens.length === 0) return false;

  const matched = tokens.filter((token) => sourceCorpus.includes(token));
  const ratio = matched.length / tokens.length;

  // Au moins 2 ancres, ou 1 ancre forte si la phrase est courte.
  if (matched.length >= 2 && ratio >= 0.4) return true;
  if (tokens.length <= 4 && matched.length >= 1 && ratio >= 0.5) return true;
  return false;
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9àâäéèêëïîôùûüçœ]+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function sanitizeReasonText(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  // Évite de republier une clé machine type « cultural-keyword:… ».
  if (/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(trimmed)) return null;
  return trimmed;
}

function truncateReason(value: string): string {
  if (value.length <= MAX_REASON_LENGTH) return value;
  const cut = value.slice(0, MAX_REASON_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
