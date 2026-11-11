import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/application/personalization/get-for-you-recommendations", () => ({
  getForYouRecommendations: vi.fn(),
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { getForYouRecommendations } from "@/application/personalization/get-for-you-recommendations";
import { getMyForYouEvents } from "./for-you-events";

describe("getMyForYouEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse sans session — aucun userId client", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    } as never);

    await expect(
      getMyForYouEvents({
        interests: ["Musique"],
        availabilities: ["flexible"],
        budget: "any",
      }),
    ).resolves.toEqual({ ok: false, reason: "unauthenticated" });

    expect(getForYouRecommendations).not.toHaveBeenCalled();
    expect(getMyForYouEvents.length).toBe(1);
  });

  it("rejette un payload invalide", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: "user-1" },
    } as never);

    await expect(
      getMyForYouEvents({ interests: ["Pirate"], budget: "any" }),
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(getForYouRecommendations).not.toHaveBeenCalled();
  });

  it("retourne la sélection pour la session courante", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: "user-1" },
    } as never);
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

    await expect(
      getMyForYouEvents({
        interests: ["Musique"],
        availabilities: ["weekend-evening"],
        budget: "any",
      }),
    ).resolves.toEqual({
      ok: true,
      events: [
        expect.objectContaining({ id: "e1", category: "Musique" }),
      ],
    });

    expect(getForYouRecommendations).toHaveBeenCalledWith({
      interests: ["Musique"],
      availabilities: ["weekend-evening"],
      budget: "any",
    });
  });

  it("erreur serveur → reason error (pas un faux vide)", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: { id: "user-1" },
    } as never);
    vi.mocked(getForYouRecommendations).mockRejectedValue(new Error("db down"));

    await expect(
      getMyForYouEvents({
        interests: ["Musique"],
        availabilities: ["flexible"],
        budget: "any",
      }),
    ).resolves.toEqual({ ok: false, reason: "error" });
  });
});
