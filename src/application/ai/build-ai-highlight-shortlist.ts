import type { EventHighlight } from "@/domain/editorial/select-detour-highlights";

export const AI_HIGHLIGHT_SHORTLIST_SIZE = 60;

/** Top du ranking déterministe toujours inclus en priorité. */
export const AI_SHORTLIST_DETERMINISTIC_TOP = 30;
/** Taille de chaque bucket complémentaire. */
export const AI_SHORTLIST_BUCKET_SIZE = 15;

export type AiShortlistInclusionReason =
  | "deterministic-top"
  | "planning-top"
  | "booking-top"
  | "peripheral-top"
  | "future-top";

export type AiShortlistBucketStats = Record<AiShortlistInclusionReason, number>;

export type AiHighlightShortlistResult = {
  shortlist: EventHighlight[];
  /** Raisons d’inclusion par eventId (un event peut en avoir plusieurs). */
  inclusionById: Map<string, AiShortlistInclusionReason[]>;
  /** Taille de chaque sous-sélection avant union / cap. */
  bucketSizes: AiShortlistBucketStats;
};

const INCLUSION_ORDER: AiShortlistInclusionReason[] = [
  "deterministic-top",
  "planning-top",
  "booking-top",
  "peripheral-top",
  "future-top",
];

/**
 * Construit le pool envoyé à l’IA : union de sous-sélections simples.
 * Ordre final = ordre d’insertion (deterministic-top d’abord, puis buckets).
 * Aucun doublon ; plafond `limit` (défaut AI_HIGHLIGHT_SHORTLIST_SIZE).
 */
export function buildAiHighlightShortlist(
  rankedCandidates: EventHighlight[],
  options?: { limit?: number },
): AiHighlightShortlistResult {
  const limit = options?.limit ?? AI_HIGHLIGHT_SHORTLIST_SIZE;
  if (limit <= 0 || rankedCandidates.length === 0) {
    return {
      shortlist: [],
      inclusionById: new Map(),
      bucketSizes: emptyBucketStats(),
    };
  }

  const buckets: Record<AiShortlistInclusionReason, EventHighlight[]> = {
    "deterministic-top": rankedCandidates.slice(0, AI_SHORTLIST_DETERMINISTIC_TOP),
    "planning-top": pickPlanningTop(rankedCandidates, AI_SHORTLIST_BUCKET_SIZE),
    "booking-top": pickBookingTop(rankedCandidates, AI_SHORTLIST_BUCKET_SIZE),
    "peripheral-top": pickPeripheralTop(
      rankedCandidates,
      AI_SHORTLIST_BUCKET_SIZE,
    ),
    "future-top": pickFutureTop(rankedCandidates, AI_SHORTLIST_BUCKET_SIZE),
  };

  const bucketSizes = emptyBucketStats();
  for (const reason of INCLUSION_ORDER) {
    bucketSizes[reason] = buckets[reason].length;
  }

  const inclusionById = new Map<string, AiShortlistInclusionReason[]>();
  const shortlist: EventHighlight[] = [];
  const selectedIds = new Set<string>();

  for (const reason of INCLUSION_ORDER) {
    for (const candidate of buckets[reason]) {
      const id = candidate.event.id;

      if (selectedIds.has(id)) {
        const existing = inclusionById.get(id);
        if (existing && !existing.includes(reason)) existing.push(reason);
        continue;
      }

      if (shortlist.length >= limit) continue;

      selectedIds.add(id);
      shortlist.push(candidate);
      inclusionById.set(id, [reason]);
    }
  }

  return { shortlist, inclusionById, bucketSizes };
}

function pickPlanningTop(
  ranked: EventHighlight[],
  size: number,
): EventHighlight[] {
  return [...ranked]
    .sort((a, b) => {
      if (b.planningScore !== a.planningScore) {
        return b.planningScore - a.planningScore;
      }
      if (b.score !== a.score) return b.score - a.score;
      return a.event.startAt.localeCompare(b.event.startAt);
    })
    .slice(0, size);
}

function pickBookingTop(
  ranked: EventHighlight[],
  size: number,
): EventHighlight[] {
  // Ordre déterministe déjà présent = meilleur score d’abord.
  return ranked
    .filter((item) => Boolean(item.event.registrationUrl))
    .slice(0, size);
}

function pickPeripheralTop(
  ranked: EventHighlight[],
  size: number,
): EventHighlight[] {
  return ranked
    .filter((item) => isPeripheralCity(item.event.city))
    .slice(0, size);
}

function pickFutureTop(
  ranked: EventHighlight[],
  size: number,
): EventHighlight[] {
  return [...ranked]
    .sort((a, b) => b.event.startAt.localeCompare(a.event.startAt))
    .slice(0, size);
}

function isPeripheralCity(city: string | null): boolean {
  if (!city?.trim()) return false;
  const normalized = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized !== "orleans";
}

function emptyBucketStats(): AiShortlistBucketStats {
  return {
    "deterministic-top": 0,
    "planning-top": 0,
    "booking-top": 0,
    "peripheral-top": 0,
    "future-top": 0,
  };
}
