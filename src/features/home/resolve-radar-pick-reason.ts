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
  /^(programm[eé]e?\s+[àa]\s+\w|dans (un |une )?(lieu|salle|commune|ville)|billetterie|inscriptions? (disponible|obligatoire|conseill)|r[eé]servations? (disponible|obligatoire|conseill)|entr[eé]e gratuite|sur inscription|gratuit(\.?)$)/i;

/**
 * Formulations vides / tautologiques — n’apportent aucun fait distinctif.
 * Complète le grounding : une phrase peut être « ancrée » et malgré tout creuse.
 */
const EMPTY_EDITORIAL_FORMULATION =
  /en lien avec l['’][eé]v[eé]nement|autour de (cet |l['’])?[eé]v[eé]nement|dans le cadre de (cet |l['’])?[eé]v[eé]nement|un [eé]v[eé]nement (culturel |local )?(à (ne )?pas manquer|incontournable)|format (attractif|int[eé]ressant|original)|susceptible d['’]attirer|th[eè]me universel|message fort/i;

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
 * Pas de lexique de « substance » imposé : l’ancrage source + rejets ciblés suffisent.
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
  const description = event.description?.trim() ?? "";

  for (const raw of reasons) {
    const cleaned = sanitizeReasonText(raw);
    if (!cleaned) continue;
    if (MACHINE_OR_GENERIC_REASON.test(cleaned)) continue;
    if (FORBIDDEN_URGENCY.test(cleaned)) continue;
    if (SHALLOW_PRACTICAL_REASON.test(cleaned)) continue;
    if (EMPTY_EDITORIAL_FORMULATION.test(cleaned)) continue;
    if (cleaned.length < 24) continue;
    if (!isGroundedInSource(cleaned, sourceCorpus)) continue;
    if (isThinSourceParaphrase(cleaned, description)) continue;
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

/**
 * Fiche source très pauvre (peu de tokens significatifs) + reason qui ne fait
 * que la reformuler → pas digne du Regard, on masque.
 * Ne vise pas les descriptions courtes mais déjà distinctives (ex. CD live).
 */
function isThinSourceParaphrase(reason: string, description: string): boolean {
  const desc = normalize(description);
  if (!desc) return false;

  const descTokens = tokenize(desc).filter(
    (token) => token.length >= 4 && !STOPWORDS.has(token),
  );
  // ≤3 ancres lexicales = fiche trop mince pour justifier un encart.
  if (descTokens.length === 0 || descTokens.length > 3) return false;

  const reasonNorm = normalize(reason);
  const reasonTokens = tokenize(reasonNorm).filter(
    (token) => token.length >= 4 && !STOPWORDS.has(token),
  );
  if (reasonTokens.length === 0) return false;

  const descSet = new Set(descTokens);
  const overlap = reasonTokens.filter((token) => descSet.has(token)).length;
  return overlap / reasonTokens.length >= 0.85;
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
