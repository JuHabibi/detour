/**
 * Signal tarifaire V1 — uniquement des preuves explicites.
 * Absent / ambigu ≠ gratuit.
 */
export type EventPriceSignal = "free" | "paid" | "unknown";

const FREE_RE =
  /(?:^|[^\p{L}\p{N}])gratuit(?:e|es|s)?(?:$|[^\p{L}\p{N}])/iu;
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

  if (FREE_RE.test(conditions)) return "free";
  if (PAID_AMOUNT_RE.test(conditions)) return "paid";

  return "unknown";
}
