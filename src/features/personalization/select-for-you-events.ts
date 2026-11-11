import type { EventItem } from "@/data/types";
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

/**
 * Filtrage local naïf — réservé à la PR 4 (branchement Explorer).
 * Conservé pour réutiliser le design du carrousel sans fake data en prod.
 */
export function selectForYouEvents(
  pool: EventItem[],
  preferences: ForYouPreferences,
  limit = 8,
): EventItem[] {
  if (pool.length === 0) return [];

  const scored = pool.map((event) => ({
    event,
    score: scoreEvent(event, preferences),
  }));

  scored.sort(
    (a, b) => b.score - a.score || a.event.title.localeCompare(b.event.title),
  );

  const interested = scored
    .filter((item) => item.score > 0)
    .map((item) => item.event);
  if (interested.length > 0) {
    return interested.slice(0, limit);
  }

  return scored.map((item) => item.event).slice(0, limit);
}

function scoreEvent(event: EventItem, preferences: ForYouPreferences): number {
  let score = 0;

  if (preferences.interests.length > 0) {
    if (preferences.interests.includes(event.category as UserProfileInterest)) {
      score += 5;
    } else {
      return 0;
    }
  }

  if (matchesBudget(event, preferences.budget)) score += 2;
  else if (preferences.budget !== "any") score -= 1;

  if (matchesAvailability(event, preferences.availabilities)) score += 2;

  if (event.price === "free" || event.price === 0) score += 0.5;

  return score;
}

function matchesBudget(event: EventItem, budget: UserProfileBudget): boolean {
  if (budget === "any") return true;
  const price = event.price;
  const isFree =
    price === "free" ||
    price === 0 ||
    /\bgratuit\b/i.test(event.conditions ?? "");
  return isFree;
}

function matchesAvailability(
  event: EventItem,
  availabilities: UserProfileAvailability[],
): boolean {
  if (availabilities.length === 0 || availabilities.includes("flexible")) {
    return true;
  }

  const start = event.startAt ? new Date(event.startAt) : null;
  if (!start || Number.isNaN(start.getTime())) return true;

  const day = start.getDay();
  const hour = start.getHours();
  const isWeekend = day === 0 || day === 6;
  const isEvening = hour >= 17;

  return availabilities.some((slot) => {
    if (slot === "flexible") return true;
    if (slot === "weekday-evening") return !isWeekend && isEvening;
    if (slot === "weekend-day") return isWeekend && !isEvening;
    if (slot === "weekend-evening") return isWeekend && isEvening;
    return false;
  });
}
