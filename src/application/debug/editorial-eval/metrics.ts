import type {
  GoldenLabel,
  GoldenSetItem,
} from "@/application/debug/editorial-eval/types";
import {
  goldenOccurrenceIds,
  isJudgeableLabel,
  resolveGoldenLabel,
} from "@/application/debug/editorial-eval/types";

export const PRECISION_RELEVANCE: Record<"MUST" | "MAYBE" | "NO", number> = {
  MUST: 1,
  MAYBE: 1,
  NO: 0,
};

export const NDCG_GAIN: Record<"MUST" | "MAYBE" | "NO", number> = {
  MUST: 3,
  MAYBE: 1,
  NO: 0,
};

export function gainForLabel(label: GoldenLabel | null | undefined): number {
  if (!isJudgeableLabel(label)) return 0;
  return NDCG_GAIN[label];
}

/**
 * nDCG : unlabeled / UNJUDGEABLE → gain 0 dans le DCG (pas traités comme NO métier).
 * IDCG : idéal sur les gains des unités golden JUGEABLES uniques présentes dans le corpus.
 */
export function ndcgAtK(gains: number[], idealGainsFromCorpus: number[], k: number): number {
  const dcg = discountedCumulativeGain(gains.slice(0, k));
  const ideal = [...idealGainsFromCorpus].sort((a, b) => b - a).slice(0, k);
  const idcg = discountedCumulativeGain(ideal);
  if (idcg === 0) return 0;
  return dcg / idcg;
}

export function discountedCumulativeGain(gains: number[]): number {
  let sum = 0;
  for (let i = 0; i < gains.length; i += 1) {
    const gain = gains[i] ?? 0;
    sum += gain / Math.log2(i + 2);
  }
  return sum;
}

/**
 * MUST recall@k = unités MUST dans le top-k / unités MUST éligibles dans le corpus.
 */
export function mustRecallAtK(params: {
  radarLabels: Array<GoldenLabel | null>;
  eligibleMustCount: number;
}): { hit: number; eligible: number; recall: number | null } {
  const hit = params.radarLabels.filter((label) => label === "MUST").length;
  const eligible = params.eligibleMustCount;
  if (eligible === 0) return { hit, eligible, recall: null };
  return { hit, eligible, recall: hit / eligible };
}

export function distributionStats(values: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  n: number;
} {
  if (values.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, n: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  return {
    mean: sum / sorted.length,
    median,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    n: sorted.length,
  };
}

export function countSlots(
  slots: Array<string | null | undefined>,
): Record<string, number> {
  const keys = [
    "strong-event",
    "easy-to-miss",
    "worth-planning",
    "rare-local",
    "wildcard",
  ] as const;
  const out: Record<string, number> = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  for (const slot of slots) {
    if (!slot) continue;
    out[slot] = (out[slot] ?? 0) + 1;
  }
  return out;
}

export function matchGoldenItem(
  item: { title: string; startAt?: string | null; eventId?: string | null },
  golden: GoldenSetItem[],
): GoldenSetItem | null {
  if (item.eventId) {
    const byOccurrence = golden.find((entry) =>
      goldenOccurrenceIds(entry).includes(item.eventId!),
    );
    if (byOccurrence) return byOccurrence;
  }

  const title = normalizeTitle(item.title);
  const candidates = golden.filter(
    (entry) => normalizeTitle(entry.titleMatch) === title,
  );
  if (candidates.length === 0) {
    const loose = golden.find(
      (entry) =>
        title.includes(normalizeTitle(entry.titleMatch)) ||
        normalizeTitle(entry.titleMatch).includes(title),
    );
    if (!loose) return null;
    if (loose.startAtMatch && item.startAt) {
      if (!item.startAt.startsWith(loose.startAtMatch)) return null;
    }
    return loose;
  }
  if (candidates.length === 1) {
    const only = candidates[0]!;
    if (only.startAtMatch && item.startAt) {
      if (!item.startAt.startsWith(only.startAtMatch)) return null;
    }
    return only;
  }

  if (item.startAt) {
    const day = item.startAt.slice(0, 10);
    const byDay = candidates.find(
      (entry) => entry.startAtMatch && day.startsWith(entry.startAtMatch),
    );
    if (byDay) return byDay;
  }

  // Highlight sans startAt : si tous les homonymes partagent le même label, l’appliquer.
  const labels = new Set(
    candidates.map((entry) => resolveGoldenLabel(entry)).filter(Boolean),
  );
  if (labels.size === 1) return candidates[0]!;

  return null;
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
