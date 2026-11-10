import {
  DEFAULT_PERSONALIZATION_STATE,
  EMPTY_PREFERENCES,
  type PersonalizationPrototypeState,
} from "./types";

export const PERSONALIZATION_STORAGE_KEY =
  "detour.personalization.prototype.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readPersonalizationState(): PersonalizationPrototypeState {
  if (typeof window === "undefined") return DEFAULT_PERSONALIZATION_STATE;
  try {
    const raw = window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
    if (!raw) return DEFAULT_PERSONALIZATION_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_PERSONALIZATION_STATE;

    const preferences = isRecord(parsed.preferences)
      ? {
          interests: Array.isArray(parsed.preferences.interests)
            ? (parsed.preferences.interests.filter(
                (item) => typeof item === "string",
              ) as PersonalizationPrototypeState["preferences"]["interests"])
            : [],
          availabilities: Array.isArray(parsed.preferences.availabilities)
            ? (parsed.preferences.availabilities.filter(
                (item) => typeof item === "string",
              ) as PersonalizationPrototypeState["preferences"]["availabilities"])
            : [],
          budget:
            typeof parsed.preferences.budget === "string"
              ? (parsed.preferences.budget as PersonalizationPrototypeState["preferences"]["budget"])
              : EMPTY_PREFERENCES.budget,
        }
      : EMPTY_PREFERENCES;

    return {
      prototypeSignedIn: parsed.prototypeSignedIn === true,
      onboardingStatus:
        parsed.onboardingStatus === "deferred" ||
        parsed.onboardingStatus === "completed" ||
        parsed.onboardingStatus === "skipped" ||
        parsed.onboardingStatus === "not_started"
          ? parsed.onboardingStatus
          : "not_started",
      preferences,
      newsletterPreviewChecked: parsed.newsletterPreviewChecked === true,
      postAuthPromptSeen: parsed.postAuthPromptSeen === true,
    };
  } catch {
    return DEFAULT_PERSONALIZATION_STATE;
  }
}

export function writePersonalizationState(
  state: PersonalizationPrototypeState,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PERSONALIZATION_STORAGE_KEY,
    JSON.stringify(state),
  );
}

export function clearPersonalizationState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PERSONALIZATION_STORAGE_KEY);
}
