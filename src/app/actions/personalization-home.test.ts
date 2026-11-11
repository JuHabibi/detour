import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "@/domain/personalization/user-profile";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/infrastructure/db/user-profile.repository", () => ({
  getUserProfile: vi.fn(),
}));

vi.mock("@/application/personalization/get-for-you-recommendations", () => ({
  getForYouRecommendations: vi.fn(),
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { getForYouRecommendations } from "@/application/personalization/get-for-you-recommendations";
import { getUserProfile } from "@/infrastructure/db/user-profile.repository";
import { getMyPersonalizationHome } from "./personalization-home";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const completedProfile: UserProfile = {
  userId: USER_ID,
  interests: ["Musique"],
  availabilities: ["weekend-evening"],
  budget: "any",
  onboardingStatus: "completed",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

describe("getMyPersonalizationHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse sans session", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    } as never);

    await expect(getMyPersonalizationHome()).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(getUserProfile).not.toHaveBeenCalled();
    expect(getForYouRecommendations).not.toHaveBeenCalled();
  });

  it("profil absent → not_configured, pas d’Explorer", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue(null);

    await expect(getMyPersonalizationHome()).resolves.toEqual({
      ok: true,
      profile: null,
      forYou: { status: "not_configured", events: [] },
    });
    expect(getForYouRecommendations).not.toHaveBeenCalled();
  });

  it("profil deferred → not_configured, pas d’Explorer", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue({
      ...completedProfile,
      onboardingStatus: "deferred",
      interests: [],
    });

    await expect(getMyPersonalizationHome()).resolves.toEqual({
      ok: true,
      profile: expect.objectContaining({ onboardingStatus: "deferred" }),
      forYou: { status: "not_configured", events: [] },
    });
    expect(getForYouRecommendations).not.toHaveBeenCalled();
  });

  it("profil completed → recommandations", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue(completedProfile);
    vi.mocked(getForYouRecommendations).mockResolvedValue({
      events: [
        {
          id: "e1",
          title: "Concert",
          category: "Musique",
          genre: "",
          venue: "Salle",
          city: "Orléans",
          date: "2026-11-14",
          dateLabel: "14 nov.",
        },
      ],
      candidateCount: 3,
      matchCount: 3,
    });

    await expect(getMyPersonalizationHome()).resolves.toEqual({
      ok: true,
      profile: completedProfile,
      forYou: {
        status: "ready",
        events: [expect.objectContaining({ id: "e1" })],
      },
    });
    expect(getAccountAuthState).toHaveBeenCalledTimes(1);
    expect(getUserProfile).toHaveBeenCalledTimes(1);
  });

  it("erreur Explorer → profil conservé, forYou error (pas de gate)", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue(completedProfile);
    vi.mocked(getForYouRecommendations).mockRejectedValue(new Error("db"));

    await expect(getMyPersonalizationHome()).resolves.toEqual({
      ok: true,
      profile: completedProfile,
      forYou: { status: "error", events: [] },
    });
  });

  it("completed sans correspondance → empty", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue(completedProfile);
    vi.mocked(getForYouRecommendations).mockResolvedValue({
      events: [],
      candidateCount: 0,
      matchCount: 0,
    });

    await expect(getMyPersonalizationHome()).resolves.toEqual({
      ok: true,
      profile: completedProfile,
      forYou: { status: "empty", events: [] },
    });
  });
});
