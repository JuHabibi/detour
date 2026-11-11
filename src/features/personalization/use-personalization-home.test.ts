// @vitest-environment happy-dom

import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushMicrotasks,
  renderHook,
} from "@/components/personal/render-hook";
import type { UserProfile } from "@/domain/personalization/user-profile";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/app/actions/personalization-home", () => ({
  getMyPersonalizationHome: vi.fn(),
}));

vi.mock("@/app/actions/for-you-events", () => ({
  getMyForYouEvents: vi.fn(),
}));

vi.mock("@/app/actions/user-profile", () => ({
  getMyUserProfile: vi.fn(),
  upsertMyUserProfile: vi.fn(),
}));

import { getMyForYouEvents } from "@/app/actions/for-you-events";
import { getMyPersonalizationHome } from "@/app/actions/personalization-home";
import { upsertMyUserProfile } from "@/app/actions/user-profile";
import { usePersonalizationHome } from "./use-personalization-home";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const completedProfile: UserProfile = {
  userId: USER_ID,
  interests: ["Cinéma"],
  availabilities: ["weekend-day"],
  budget: "any",
  onboardingStatus: "completed",
  createdAt: "2026-11-10T10:00:00.000Z",
  updatedAt: "2026-11-10T11:00:00.000Z",
};

describe("usePersonalizationHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guest → aucun appel serveur", async () => {
    const { result, unmount } = renderHook(() => usePersonalizationHome(null));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(getMyPersonalizationHome).not.toHaveBeenCalled();
    expect(getMyForYouEvents).not.toHaveBeenCalled();
    expect(result.current.showGate).toBe(false);
    unmount();
  });

  it("sans profil → gate, pas de carrousel", async () => {
    vi.mocked(getMyPersonalizationHome).mockResolvedValue({
      ok: true,
      profile: null,
      forYou: { status: "not_configured", events: [] },
    });
    const { result, unmount } = renderHook(() =>
      usePersonalizationHome(USER_ID),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showGate).toBe(true);
    expect(result.current.forYouState.status).toBe("not_configured");
    expect(getMyPersonalizationHome).toHaveBeenCalled();
    expect(getMyForYouEvents).not.toHaveBeenCalled();
    unmount();
  });

  it("deferred → cue, pas de recommandations", async () => {
    vi.mocked(getMyPersonalizationHome).mockResolvedValue({
      ok: true,
      profile: {
        ...completedProfile,
        onboardingStatus: "deferred",
        interests: [],
      },
      forYou: { status: "not_configured", events: [] },
    });
    const { result, unmount } = renderHook(() =>
      usePersonalizationHome(USER_ID),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showDeferredCue).toBe(true);
    expect(result.current.forYouState.status).toBe("not_configured");
    unmount();
  });

  it("completed → carrousel via bundle unique", async () => {
    vi.mocked(getMyPersonalizationHome).mockResolvedValue({
      ok: true,
      profile: completedProfile,
      forYou: {
        status: "ready",
        events: [
          {
            id: "e1",
            title: "Film",
            category: "Cinéma",
            genre: "",
            venue: "Ciné",
            city: "Orléans",
            date: "2026-11-14",
            dateLabel: "14 nov.",
          },
        ],
      },
    });
    const { result, unmount } = renderHook(() =>
      usePersonalizationHome(USER_ID),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.forYouState).toEqual({
      status: "ready",
      events: [expect.objectContaining({ id: "e1" })],
    });
    expect(getMyPersonalizationHome).toHaveBeenCalledTimes(1);
    expect(getMyForYouEvents).not.toHaveBeenCalled();
    unmount();
  });

  it("erreur Explorer → profil conservé, forYou error, pas de gate", async () => {
    vi.mocked(getMyPersonalizationHome).mockResolvedValue({
      ok: true,
      profile: completedProfile,
      forYou: { status: "error", events: [] },
    });
    const { result, unmount } = renderHook(() =>
      usePersonalizationHome(USER_ID),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.profile).toEqual(completedProfile);
    expect(result.current.showGate).toBe(false);
    expect(result.current.forYouState.status).toBe("error");

    vi.mocked(getMyForYouEvents).mockResolvedValue({
      ok: true,
      events: [
        {
          id: "e2",
          title: "Retry",
          category: "Cinéma",
          genre: "",
          venue: "Ciné",
          city: "Orléans",
          date: "2026-11-15",
          dateLabel: "15 nov.",
        },
      ],
    });
    await act(async () => {
      await result.current.refreshForYou();
      await flushMicrotasks();
    });
    expect(result.current.forYouState.status).toBe("ready");
    unmount();
  });

  it("null → completed : carrousel sans rechargement (profil immédiat)", async () => {
    vi.mocked(getMyPersonalizationHome).mockResolvedValue({
      ok: true,
      profile: null,
      forYou: { status: "not_configured", events: [] },
    });
    vi.mocked(upsertMyUserProfile).mockResolvedValue({
      ok: true,
      profile: completedProfile,
    });
    vi.mocked(getMyForYouEvents).mockResolvedValue({
      ok: true,
      events: [
        {
          id: "onboard-1",
          title: "Première",
          category: "Cinéma",
          genre: "",
          venue: "Ciné",
          city: "Orléans",
          date: "2026-11-14",
          dateLabel: "14 nov.",
        },
      ],
    });

    const { result, unmount } = renderHook(() =>
      usePersonalizationHome(USER_ID),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showGate).toBe(true);
    expect(result.current.forYouState.status).toBe("not_configured");

    await act(async () => {
      await result.current.complete({
        interests: ["Cinéma"],
        availabilities: ["weekend-day"],
        budget: "any",
        onboardingStatus: "completed",
      });
      await flushMicrotasks();
    });

    expect(getMyForYouEvents).toHaveBeenCalledTimes(1);
    expect(getMyPersonalizationHome).toHaveBeenCalledTimes(1);
    expect(result.current.showGate).toBe(false);
    expect(result.current.forYouState).toEqual({
      status: "ready",
      events: [expect.objectContaining({ id: "onboard-1" })],
    });
    unmount();
  });

  it("deferred → completed : carrousel après validation", async () => {
    vi.mocked(getMyPersonalizationHome).mockResolvedValue({
      ok: true,
      profile: {
        ...completedProfile,
        onboardingStatus: "deferred",
        interests: [],
      },
      forYou: { status: "not_configured", events: [] },
    });
    vi.mocked(upsertMyUserProfile).mockResolvedValue({
      ok: true,
      profile: {
        ...completedProfile,
        interests: ["Musique"],
        updatedAt: "2026-11-11T17:00:00.000Z",
      },
    });
    vi.mocked(getMyForYouEvents).mockResolvedValue({
      ok: true,
      events: [
        {
          id: "def-1",
          title: "Concert",
          category: "Musique",
          genre: "",
          venue: "Salle",
          city: "Orléans",
          date: "2026-11-16",
          dateLabel: "16 nov.",
        },
      ],
    });

    const { result, unmount } = renderHook(() =>
      usePersonalizationHome(USER_ID),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showDeferredCue).toBe(true);

    await act(async () => {
      await result.current.complete({
        interests: ["Musique"],
        availabilities: ["flexible"],
        budget: "any",
        onboardingStatus: "completed",
      });
      await flushMicrotasks();
    });

    expect(getMyForYouEvents).toHaveBeenCalledTimes(1);
    expect(getMyPersonalizationHome).toHaveBeenCalledTimes(1);
    expect(result.current.showDeferredCue).toBe(false);
    expect(result.current.forYouState).toEqual({
      status: "ready",
      events: [expect.objectContaining({ id: "def-1" })],
    });
    unmount();
  });

  it("modification d’un profil completed → refresh for-you seul", async () => {
    vi.mocked(getMyPersonalizationHome).mockResolvedValue({
      ok: true,
      profile: completedProfile,
      forYou: { status: "ready", events: [] },
    });
    vi.mocked(upsertMyUserProfile).mockResolvedValue({
      ok: true,
      profile: {
        ...completedProfile,
        interests: ["Musique"],
        updatedAt: "2026-11-11T16:00:00.000Z",
      },
    });
    vi.mocked(getMyForYouEvents).mockResolvedValue({
      ok: true,
      events: [
        {
          id: "m1",
          title: "Concert",
          category: "Musique",
          genre: "",
          venue: "Salle",
          city: "Orléans",
          date: "2026-11-16",
          dateLabel: "16 nov.",
        },
      ],
    });

    const { result, unmount } = renderHook(() =>
      usePersonalizationHome(USER_ID),
    );
    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      await result.current.complete({
        interests: ["Musique"],
        availabilities: ["flexible"],
        budget: "any",
        onboardingStatus: "completed",
      });
      await flushMicrotasks();
    });

    expect(upsertMyUserProfile).toHaveBeenCalled();
    expect(getMyForYouEvents).toHaveBeenCalledTimes(1);
    expect(result.current.forYouState).toEqual({
      status: "ready",
      events: [expect.objectContaining({ id: "m1" })],
    });
    // Pas de second bundle initial.
    expect(getMyPersonalizationHome).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("changement de compte → isolation, pas de fuite", async () => {
    vi.mocked(getMyPersonalizationHome)
      .mockResolvedValueOnce({
        ok: true,
        profile: completedProfile,
        forYou: {
          status: "ready",
          events: [
            {
              id: "a",
              title: "A",
              category: "Cinéma",
              genre: "",
              venue: "X",
              city: "Orléans",
              date: "2026-11-14",
              dateLabel: "14 nov.",
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        profile: {
          ...completedProfile,
          userId: USER_B,
          interests: ["Musique"],
        },
        forYou: {
          status: "ready",
          events: [
            {
              id: "b",
              title: "B",
              category: "Musique",
              genre: "",
              venue: "Y",
              city: "Orléans",
              date: "2026-11-15",
              dateLabel: "15 nov.",
            },
          ],
        },
      });

    let currentUser: string | null = USER_ID;
    const { result, rerender, unmount } = renderHook(() =>
      usePersonalizationHome(currentUser),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.forYouState).toEqual({
      status: "ready",
      events: [expect.objectContaining({ id: "a" })],
    });

    currentUser = USER_B;
    await act(async () => {
      rerender();
      await flushMicrotasks();
    });
    expect(result.current.profile?.userId).toBe(USER_B);
    expect(result.current.forYouState).toEqual({
      status: "ready",
      events: [expect.objectContaining({ id: "b" })],
    });
    unmount();
  });
});
