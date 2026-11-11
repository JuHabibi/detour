import {
  USER_PROFILE_AVAILABILITIES,
  USER_PROFILE_BUDGETS,
  USER_PROFILE_INTERESTS,
  type UserProfileAvailability,
  type UserProfileBudget,
  type UserProfileInterest,
} from "@/domain/personalization/user-profile";
import type { ForYouPreferences } from "@/domain/personalization/select-for-you-events";

const INTEREST_SET = new Set<string>(USER_PROFILE_INTERESTS);
const AVAILABILITY_SET = new Set<string>(USER_PROFILE_AVAILABILITIES);
const BUDGET_SET = new Set<string>(USER_PROFILE_BUDGETS);

export type ParseForYouPreferencesResult =
  | { ok: true; value: ForYouPreferences }
  | { ok: false; reason: string };

/** Validation allowlist — préférences « Pour vous » sans statut d’onboarding. */
export function parseForYouPreferences(
  input: unknown,
): ParseForYouPreferencesResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "invalid_payload" };
  }
  const record = input as Record<string, unknown>;

  if (!Array.isArray(record.interests)) {
    return { ok: false, reason: "invalid_interests" };
  }
  if (!Array.isArray(record.availabilities)) {
    return { ok: false, reason: "invalid_availabilities" };
  }
  if (typeof record.budget !== "string" || !BUDGET_SET.has(record.budget)) {
    return { ok: false, reason: "invalid_budget" };
  }

  if (!record.interests.every((item) => typeof item === "string")) {
    return { ok: false, reason: "invalid_interests" };
  }
  const interests = uniqueStrings(record.interests);
  if (
    interests.length === 0 ||
    !interests.every((item) => INTEREST_SET.has(item))
  ) {
    return { ok: false, reason: "invalid_interests" };
  }

  if (!record.availabilities.every((item) => typeof item === "string")) {
    return { ok: false, reason: "invalid_availabilities" };
  }
  const availabilities = uniqueStrings(record.availabilities);
  if (!availabilities.every((item) => AVAILABILITY_SET.has(item))) {
    return { ok: false, reason: "invalid_availabilities" };
  }

  return {
    ok: true,
    value: {
      interests: interests as UserProfileInterest[],
      availabilities: availabilities as UserProfileAvailability[],
      budget: record.budget as UserProfileBudget,
    },
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
