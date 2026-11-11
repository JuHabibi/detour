/**
 * Signal tarifaire V1 — uniquement des preuves explicites et non conditionnelles.
 * Absent / ambigu / conditionnel ≠ gratuit.
 */
export type EventPriceSignal = "free" | "paid" | "unknown";

/** Mentions de gratuité / entrée libre sans preuve tarifaire structurée. */
const FREE_MENTION_RE =
  /(?:^|[^\p{L}\p{N}])(?:gratuit(?:e|es|s)?|entr[ée]e\s+libre|acc[èe]s\s+libre)(?:$|[^\p{L}\p{N}])/iu;

/** Mentions qui annulent le bonus gratuit (restriction, négation, mixte). */
const FREE_DISQUALIFY_RE =
  /(?:non\s+gratuit)|(?:pas\s+gratuit)|(?:(?:gratuit(?:e|es|s)?|entr[ée]e\s+libre|acc[èe]s\s+libre)\s*(?:pour|aux|si|sauf|hors|except[ée]s?|uniquement|seulement|sous|sur|les?\s+moins(?:\s+de)?|moins\s+de|adhérents?|membres?|étudiants?|scolaires?|certains|le\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)|\d))|(?:gratuit(?:e|es|s)?.{0,40}payant)|(?:payant.{0,40}gratuit(?:e|es|s)?)/iu;

const PAID_AMOUNT_RE =
  /(?:\d+(?:[.,]\d+)?\s*€)|(?:€\s*\d+(?:[.,]\d+)?)|(?:\d+(?:[.,]\d+)?\s*euros?\b)/i;

export function resolveEventPriceSignal(input: {
  price?: number | "free" | null;
  conditions?: string | null;
}): EventPriceSignal {
  const price = input.price;
  if (price === "free" || price === 0) return "free";
  if (typeof price === "number" && Number.isFinite(price) && price > 0) {
    return "paid";
  }

  const conditions = input.conditions?.trim() ?? "";
  if (!conditions) return "unknown";

  const hasFreeMention = FREE_MENTION_RE.test(conditions);
  const disqualified = FREE_DISQUALIFY_RE.test(conditions);
  const hasPaidAmount = PAID_AMOUNT_RE.test(conditions);

  // Conservateur : restriction / négation / mixte → jamais « free ».
  if (hasFreeMention && disqualified) return "unknown";
  if (hasFreeMention && hasPaidAmount) return "unknown";
  if (hasFreeMention) return "free";
  if (hasPaidAmount) return "paid";

  return "unknown";
}
