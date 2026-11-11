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
import { getMyForYouEvents } from "./for-you-events";

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

describe("getMyForYouEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse sans session — aucun userId client", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    } as never);

    await expect(getMyForYouEvents()).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });

    expect(getUserProfile).not.toHaveBeenCalled();
    expect(getForYouRecommendations).not.toHaveBeenCalled();
    expect(getMyForYouEvents.length).toBe(0);
  });

  it("profil absent → aucun appel Explorer", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue(null);

    await expect(getMyForYouEvents()).resolves.toEqual({
      ok: true,
      events: [],
    });
    expect(getUserProfile).toHaveBeenCalledWith(USER_ID);
    expect(getForYouRecommendations).not.toHaveBeenCalled();
  });

  it("profil deferred → aucun appel Explorer", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue({
      ...completedProfile,
      onboardingStatus: "deferred",
      interests: [],
    });

    await expect(getMyForYouEvents()).resolves.toEqual({
      ok: true,
      events: [],
    });
    expect(getForYouRecommendations).not.toHaveBeenCalled();
  });

  it("utilise exclusivement le profil persisté (ignore toute préférence client)", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue({
      ...completedProfile,
      interests: ["Exposition"],
      availabilities: ["weekend-day"],
      budget: "free_preferred",
    });
    vi.mocked(getForYouRecommendations).mockResolvedValue({
      events: [
        {
          id: "e1",
          title: "Expo",
          category: "Exposition",
          genre: "",
          venue: "Musée",
          city: "Orléans",
          date: "2026-11-15",
          dateLabel: "15 nov.",
        },
      ],
      candidateCount: 2,
      matchCount: 2,
    });

    // Signature sans argument — impossible d’injecter des prefs client.
    await expect(getMyForYouEvents()).resolves.toEqual({
      ok: true,
      events: [expect.objectContaining({ id: "e1", category: "Exposition" })],
    });

    expect(getForYouRecommendations).toHaveBeenCalledTimes(1);
    expect(getForYouRecommendations).toHaveBeenCalledWith({
      interests: ["Exposition"],
      availabilities: ["weekend-day"],
      budget: "free_preferred",
    });
    expect(getForYouRecommendations).not.toHaveBeenCalledWith(
      expect.objectContaining({ interests: ["Musique"] }),
    );
  });

  it("retourne la sélection pour le profil completed de la session", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue({ ...completedProfile });
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

    await expect(getMyForYouEvents()).resolves.toEqual({
      ok: true,
      events: [expect.objectContaining({ id: "e1", category: "Musique" })],
    });
  });

  it("erreur serveur → reason error (pas un faux vide)", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: USER_ID },
    } as never);
    vi.mocked(getUserProfile).mockResolvedValue({ ...completedProfile });
    vi.mocked(getForYouRecommendations).mockRejectedValue(new Error("db down"));

    await expect(getMyForYouEvents()).resolves.toEqual({
      ok: false,
      reason: "error",
    });
  });
});
