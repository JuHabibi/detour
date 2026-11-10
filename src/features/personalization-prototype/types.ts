import type { CategoryId } from "@/data/types";

/** Centres d’intérêt proposés — hors « Tout ». */
export type InterestId = Exclude<CategoryId, "tout">;

export type AvailabilityId =
  | "weekday-evening"
  | "weekend-day"
  | "weekend-evening"
  | "flexible";

export type BudgetId = "free" | "under-15" | "under-30" | "any";

export type OnboardingStatus =
  | "not_started"
  | "deferred"
  | "completed"
  | "skipped";

export type PersonalizationPreferences = {
  interests: InterestId[];
  availabilities: AvailabilityId[];
  budget: BudgetId;
};

/**
 * État prototype — localStorage uniquement.
 * `newsletterPreviewChecked` est un aperçu UI, pas un consentement.
 */
export type PersonalizationPrototypeState = {
  /** Simule une session connectée sans Better Auth (tests locaux). */
  prototypeSignedIn: boolean;
  onboardingStatus: OnboardingStatus;
  preferences: PersonalizationPreferences;
  /** Aperçu newsletter — jamais traité comme consentement légal. */
  newsletterPreviewChecked: boolean;
  /** Prompt post-connexion déjà présenté pour cette « session » locale. */
  postAuthPromptSeen: boolean;
};

export const EMPTY_PREFERENCES: PersonalizationPreferences = {
  interests: [],
  availabilities: [],
  budget: "any",
};

export const DEFAULT_PERSONALIZATION_STATE: PersonalizationPrototypeState = {
  prototypeSignedIn: false,
  onboardingStatus: "not_started",
  preferences: EMPTY_PREFERENCES,
  newsletterPreviewChecked: false,
  postAuthPromptSeen: false,
};
