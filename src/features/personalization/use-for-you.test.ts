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

vi.mock("@/app/actions/for-you-events", () => ({
  getMyForYouEvents: vi.fn(),
}));

import { getMyForYouEvents } from "@/app/actions/for-you-events";
import { useForYou } from "./use-for-you";

function completedProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    userId: "u1",
    interests: ["Musique"],
    availabilities: ["weekend-evening"],
    budget: "any",
    onboardingStatus: "completed",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useForYou", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("profil deferred → pas de sélection", async () => {
    const { result, unmount } = renderHook(() =>
      useForYou(
        "u1",
        completedProfile({ onboardingStatus: "deferred", interests: [] }),
        true,
      ),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.state.status).toBe("not_configured");
    expect(getMyForYouEvents).not.toHaveBeenCalled();
    unmount();
  });

  it("profil completed → charge la sélection", async () => {
    vi.mocked(getMyForYouEvents).mockResolvedValue({
      ok: true,
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
    });

    const { result, unmount } = renderHook(() =>
      useForYou("u1", completedProfile(), true),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status === "ready") {
      expect(result.current.state.events[0]?.id).toBe("e1");
    }
    unmount();
  });

  it("modification des préférences → rechargement", async () => {
    vi.mocked(getMyForYouEvents)
      .mockResolvedValueOnce({
        ok: true,
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
      })
      .mockResolvedValueOnce({
        ok: true,
        events: [
          {
            id: "e2",
            title: "Film",
            category: "Cinéma",
            genre: "",
            venue: "Ciné",
            city: "Orléans",
            date: "2026-11-15",
            dateLabel: "15 nov.",
          },
        ],
      });

    let profile = completedProfile();
    const { result, rerender, unmount } = renderHook(() =>
      useForYou("u1", profile, true),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.state.status).toBe("ready");

    profile = completedProfile({
      interests: ["Cinéma"],
      updatedAt: "2026-11-11T15:00:00.000Z",
    });
    await act(async () => {
      rerender();
      await flushMicrotasks();
    });

    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status === "ready") {
      expect(result.current.state.events[0]?.id).toBe("e2");
    }
    expect(getMyForYouEvents).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("erreur serveur → état error (pas empty)", async () => {
    vi.mocked(getMyForYouEvents).mockResolvedValue({
      ok: false,
      reason: "error",
    });

    const { result, unmount } = renderHook(() =>
      useForYou("u1", completedProfile(), true),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.state.status).toBe("error");

    vi.mocked(getMyForYouEvents).mockResolvedValue({ ok: true, events: [] });
    await act(async () => {
      await result.current.refresh();
      await flushMicrotasks();
    });
    expect(result.current.state.status).toBe("empty");
    unmount();
  });

  it("zéro correspondance → empty", async () => {
    vi.mocked(getMyForYouEvents).mockResolvedValue({ ok: true, events: [] });

    const { result, unmount } = renderHook(() =>
      useForYou("u1", completedProfile(), true),
    );
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.state.status).toBe("empty");
    unmount();
  });
});
