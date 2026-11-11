import { getParisCivil } from "@/domain/time/when-filter";
import { resolveEventPriceSignal } from "@/domain/personalization/event-price-signal";
import type {
  UserProfileAvailability,
  UserProfileBudget,
  UserProfileInterest,
} from "@/domain/personalization/user-profile";

export type ForYouPreferences = {
  interests: UserProfileInterest[];
  availabilities: UserProfileAvailability[];
  budget: UserProfileBudget;
};

/** Vue minimale pour le ranking — indépendante du view-model UI. */
export type ForYouCandidate = {
  id: string;
  title: string;
  category: string;
  startAt?: string | null;
  venue?: string | null;
  price?: number | "free" | null;
  conditions?: string | null;
  allDay?: boolean;
};

export const FOR_YOU_MAX_RESULTS = 8;

const INTEREST_BASE = 100;
const AVAILABILITY_BOOST = 20;
const FREE_PREFERRED_BOOST = 15;
const RECENCY_MAX_BOOST = 10;
/** Au-delà, le boost de proximité temporelle est nul. */
const RECENCY_HORIZON_DAYS = 45;
const MAX_PER_VENUE = 2;
const EVENING_HOUR_PARIS = 17;

type ScoredCandidate = {
  candidate: ForYouCandidate;
  score: number;
  startMs: number | null;
  venueKey: string;
  titleKey: string;
};

export type ForYouScoreBreakdown = {
  score: number;
  reasons: string[];
};

/**
 * Sélection déterministe « Pour vous » V1.
 * Priorité 1 (intérêts) = filtre dur — jamais de remplissage hors catégorie.
 */
export function selectForYouEvents<T extends ForYouCandidate>(
  pool: readonly T[],
  preferences: ForYouPreferences,
  limit = FOR_YOU_MAX_RESULTS,
  now: Date = new Date(),
): T[] {
  return rankForYouEvents(pool, preferences, limit, now).map(
    (item) => item.candidate,
  );
}

/** Ranking + raisons (éval / debug) — même ordre que `selectForYouEvents`. */
export function rankForYouEvents<T extends ForYouCandidate>(
  pool: readonly T[],
  preferences: ForYouPreferences,
  limit = FOR_YOU_MAX_RESULTS,
  now: Date = new Date(),
): Array<{ candidate: T; score: number; reasons: string[] }> {
  if (pool.length === 0 || preferences.interests.length === 0) return [];

  const interestSet = new Set<string>(preferences.interests);
  const nowMs = now.getTime();
  const scored: Array<ScoredCandidate & { reasons: string[]; typed: T }> = [];

  for (const candidate of pool) {
    if (!interestSet.has(candidate.category)) continue;

    const startMs = parseStartMs(candidate.startAt);
    const breakdown = scoreCandidate(candidate, preferences, nowMs, startMs);
    if (breakdown.score <= 0) continue;

    scored.push({
      candidate,
      typed: candidate,
      score: breakdown.score,
      reasons: breakdown.reasons,
      startMs,
      venueKey: normalizeKey(candidate.venue) || `id:${candidate.id}`,
      titleKey: normalizeKey(candidate.title) || `id:${candidate.id}`,
    });
  }

  scored.sort(compareScored);

  return pickDiverse(scored, limit).map((item) => ({
    candidate: item.typed,
    score: item.score,
    reasons: item.reasons,
  }));
}

function scoreCandidate(
  candidate: ForYouCandidate,
  preferences: ForYouPreferences,
  nowMs: number,
  startMs: number | null,
): ForYouScoreBreakdown {
  let score = INTEREST_BASE;
  const reasons = [`intérêt:${candidate.category}`];

  if (matchesAvailability(candidate, preferences.availabilities, startMs)) {
    score += AVAILABILITY_BOOST;
    reasons.push("disponibilité");
  }

  const priceSignal = resolveEventPriceSignal(candidate);
  if (preferences.budget === "free_preferred" && priceSignal === "free") {
    score += FREE_PREFERRED_BOOST;
    reasons.push("gratuit");
  }

  const recency = recencyBoost(nowMs, startMs);
  if (recency > 0) {
    score += recency;
    reasons.push(`proximité:${recency}`);
  }

  return { score, reasons };
}

function matchesAvailability(
  candidate: ForYouCandidate,
  availabilities: UserProfileAvailability[],
  startMs: number | null,
): boolean {
  if (availabilities.length === 0 || availabilities.includes("flexible")) {
    return true;
  }

  if (startMs == null) return false;

  const paris = getParisCivil(new Date(startMs));
  const isWeekend = paris.weekday === 0 || paris.weekday === 6;
  // Journée entière → créneau journée (pas soirée).
  const isEvening = candidate.allDay ? false : paris.hour >= EVENING_HOUR_PARIS;

  return availabilities.some((slot) => {
    if (slot === "flexible") return true;
    if (slot === "weekday-evening") return !isWeekend && isEvening;
    if (slot === "weekend-day") return isWeekend && !isEvening;
    if (slot === "weekend-evening") return isWeekend && isEvening;
    return false;
  });
}

function recencyBoost(nowMs: number, startMs: number | null): number {
  if (startMs == null) return 0;
  const deltaMs = startMs - nowMs;
  if (deltaMs < 0) return 0;
  const days = deltaMs / (24 * 60 * 60 * 1000);
  if (days >= RECENCY_HORIZON_DAYS) return 0;
  return Math.round(
    RECENCY_MAX_BOOST * (1 - days / RECENCY_HORIZON_DAYS) * 1000,
  ) / 1000;
}

function pickDiverse<T extends ScoredCandidate>(
  scored: readonly T[],
  limit: number,
): T[] {
  const selected: T[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const venueCounts = new Map<string, number>();

  for (const item of scored) {
    if (selected.length >= limit) break;

    const { candidate, venueKey, titleKey } = item;
    if (seenIds.has(candidate.id)) continue;
    if (seenTitles.has(titleKey)) continue;
    if ((venueCounts.get(venueKey) ?? 0) >= MAX_PER_VENUE) continue;

    selected.push(item);
    seenIds.add(candidate.id);
    seenTitles.add(titleKey);
    venueCounts.set(venueKey, (venueCounts.get(venueKey) ?? 0) + 1);
  }

  return selected;
}

function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  const aStart = a.startMs ?? Number.POSITIVE_INFINITY;
  const bStart = b.startMs ?? Number.POSITIVE_INFINITY;
  if (aStart !== bStart) return aStart - bStart;
  return a.candidate.id.localeCompare(b.candidate.id);
}

function parseStartMs(startAt: string | null | undefined): number | null {
  if (!startAt) return null;
  const ms = Date.parse(startAt);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
