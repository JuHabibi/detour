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
  if (pool.length === 0 || preferences.interests.length === 0) return [];

  const interestSet = new Set<string>(preferences.interests);
  const nowMs = now.getTime();
  const scored: ScoredCandidate[] = [];

  for (const candidate of pool) {
    if (!interestSet.has(candidate.category)) continue;

    const startMs = parseStartMs(candidate.startAt);
    const score = scoreCandidate(candidate, preferences, nowMs, startMs);
    if (score <= 0) continue;

    scored.push({
      candidate,
      score,
      startMs,
      venueKey: normalizeKey(candidate.venue) || `id:${candidate.id}`,
      titleKey: normalizeKey(candidate.title) || `id:${candidate.id}`,
    });
  }

  scored.sort(compareScored);

  return pickDiverse(scored, limit).map((item) => item.candidate as T);
}

function scoreCandidate(
  candidate: ForYouCandidate,
  preferences: ForYouPreferences,
  nowMs: number,
  startMs: number | null,
): number {
  let score = INTEREST_BASE;

  if (matchesAvailability(candidate, preferences.availabilities, startMs)) {
    score += AVAILABILITY_BOOST;
  }

  const priceSignal = resolveEventPriceSignal(candidate);
  if (preferences.budget === "free_preferred" && priceSignal === "free") {
    score += FREE_PREFERRED_BOOST;
  }

  score += recencyBoost(nowMs, startMs);

  return score;
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

function pickDiverse(
  scored: readonly ScoredCandidate[],
  limit: number,
): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
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
