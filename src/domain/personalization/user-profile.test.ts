import { describe, expect, it } from "vitest";
import { parseUserProfileWrite } from "@/domain/personalization/user-profile";

describe("parseUserProfileWrite", () => {
  it("accepte un profil completed valide", () => {
    expect(
      parseUserProfileWrite({
        interests: ["Cinéma", "Musique", "Cinéma"],
        availabilities: ["weekend-day", "flexible"],
        budget: "free_preferred",
        onboardingStatus: "completed",
      }),
    ).toEqual({
      ok: true,
      value: {
        interests: ["Cinéma", "Musique"],
        availabilities: ["weekend-day", "flexible"],
        budget: "free_preferred",
        onboardingStatus: "completed",
      },
    });
  });

  it("accepte deferred sans intérêts", () => {
    expect(
      parseUserProfileWrite({
        interests: [],
        availabilities: [],
        budget: "any",
        onboardingStatus: "deferred",
      }),
    ).toMatchObject({ ok: true });
  });

  it("refuse completed sans intérêts", () => {
    expect(
      parseUserProfileWrite({
        interests: [],
        availabilities: ["flexible"],
        budget: "any",
        onboardingStatus: "completed",
      }),
    ).toEqual({ ok: false, reason: "completed_requires_interests" });
  });

  it("refuse budget / intérêts / statut hors allowlist", () => {
    expect(
      parseUserProfileWrite({
        interests: ["Spectacle"],
        availabilities: ["flexible"],
        budget: "under-15",
        onboardingStatus: "completed",
      }),
    ).toEqual({ ok: false, reason: "invalid_budget" });

    expect(
      parseUserProfileWrite({
        interests: ["Autre"],
        availabilities: ["flexible"],
        budget: "any",
        onboardingStatus: "completed",
      }),
    ).toEqual({ ok: false, reason: "invalid_interests" });

    expect(
      parseUserProfileWrite({
        interests: ["Spectacle"],
        availabilities: ["flexible"],
        budget: "any",
        onboardingStatus: "skipped",
      }),
    ).toEqual({ ok: false, reason: "invalid_onboarding_status" });
  });
});
