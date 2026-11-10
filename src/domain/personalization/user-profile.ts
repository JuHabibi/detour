import type { DetourCategory } from "@/domain/events/classify-event-category";

/** Centres d’intérêt persistés — taxonomie produit hors « Autre ». */
export type UserProfileInterest = Exclude<DetourCategory, "Autre">;

export const USER_PROFILE_INTERESTS = [
  "Musique",
  "Spectacle",
  "Cinéma",
  "Exposition",
  "Atelier",
  "Jeune public",
  "Rencontre",
  "Visite",
  "Fête / salon / marché",
  "Loisirs culturels",
] as const satisfies readonly UserProfileInterest[];

export type UserProfileAvailability =
  | "weekday-evening"
  | "weekend-day"
  | "weekend-evening"
  | "flexible";

export const USER_PROFILE_AVAILABILITIES = [
  "weekday-evening",
  "weekend-day",
  "weekend-evening",
  "flexible",
] as const satisfies readonly UserProfileAvailability[];

/**
 * Budget V1 — les tarifs source sont du texte libre :
 * pas de seuils € fiables. « free_preferred » = privilégier le gratuit.
 */
export type UserProfileBudget = "free_preferred" | "any";

export const USER_PROFILE_BUDGETS = [
  "free_preferred",
  "any",
] as const satisfies readonly UserProfileBudget[];

export type UserProfileOnboardingStatus = "deferred" | "completed";

export const USER_PROFILE_ONBOARDING_STATUSES = [
  "deferred",
  "completed",
] as const satisfies readonly UserProfileOnboardingStatus[];

export type UserProfile = {
  userId: string;
  interests: UserProfileInterest[];
  availabilities: UserProfileAvailability[];
  budget: UserProfileBudget;
  onboardingStatus: UserProfileOnboardingStatus;
  createdAt: string;
  updatedAt: string;
};

export type UserProfileWrite = {
  interests: UserProfileInterest[];
  availabilities: UserProfileAvailability[];
  budget: UserProfileBudget;
  onboardingStatus: UserProfileOnboardingStatus;
};

const INTEREST_SET = new Set<string>(USER_PROFILE_INTERESTS);
const AVAILABILITY_SET = new Set<string>(USER_PROFILE_AVAILABILITIES);
const BUDGET_SET = new Set<string>(USER_PROFILE_BUDGETS);
const STATUS_SET = new Set<string>(USER_PROFILE_ONBOARDING_STATUSES);

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

export type ParseUserProfileWriteResult =
  | { ok: true; value: UserProfileWrite }
  | { ok: false; reason: string };

/** Validation pure — allowlists stables V1. */
export function parseUserProfileWrite(
  input: unknown,
): ParseUserProfileWriteResult {
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
  if (
    typeof record.onboardingStatus !== "string" ||
    !STATUS_SET.has(record.onboardingStatus)
  ) {
    return { ok: false, reason: "invalid_onboarding_status" };
  }

  const interestsRaw = record.interests;
  if (!interestsRaw.every((item) => typeof item === "string")) {
    return { ok: false, reason: "invalid_interests" };
  }
  const interests = uniqueStrings(interestsRaw);
  if (!interests.every((item) => INTEREST_SET.has(item))) {
    return { ok: false, reason: "invalid_interests" };
  }

  const availabilitiesRaw = record.availabilities;
  if (!availabilitiesRaw.every((item) => typeof item === "string")) {
    return { ok: false, reason: "invalid_availabilities" };
  }
  const availabilities = uniqueStrings(availabilitiesRaw);
  if (!availabilities.every((item) => AVAILABILITY_SET.has(item))) {
    return { ok: false, reason: "invalid_availabilities" };
  }

  if (
    record.onboardingStatus === "completed" &&
    interests.length === 0
  ) {
    return { ok: false, reason: "completed_requires_interests" };
  }

  return {
    ok: true,
    value: {
      interests: interests as UserProfileInterest[],
      availabilities: availabilities as UserProfileAvailability[],
      budget: record.budget as UserProfileBudget,
      onboardingStatus: record.onboardingStatus as UserProfileOnboardingStatus,
    },
  };
}
