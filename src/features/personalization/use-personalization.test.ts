// @vitest-environment happy-dom

import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushMicrotasks,
  renderHook,
} from "@/components/personal/render-hook";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/app/actions/user-profile", () => ({
  getMyUserProfile: vi.fn(),
  upsertMyUserProfile: vi.fn(),
}));

import {
  getMyUserProfile,
  upsertMyUserProfile,
} from "@/app/actions/user-profile";
import type { UserProfile } from "@/domain/personalization/user-profile";
import { usePersonalization } from "./use-personalization";

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

const deferredProfile: UserProfile = {
  ...completedProfile,
  interests: [],
  availabilities: [],
  onboardingStatus: "deferred",
};

const completedProfileB: UserProfile = {
  ...completedProfile,
  userId: USER_B,
  interests: ["Musique"],
  availabilities: ["weekday-evening"],
  budget: "free_preferred",
};

describe("usePersonalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilisateur non connecté → pas d’appel serveur, pas de gate", async () => {
    const { result, unmount } = renderHook(() => usePersonalization(null));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(getMyUserProfile).not.toHaveBeenCalled();
    expect(result.current.showGate).toBe(false);
    expect(result.current.profile).toBeNull();
    unmount();
  });

  it("nouveau compte / compte existant sans profil → propose la gate", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({ ok: true, profile: null });
    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.showGate).toBe(true);
    expect(result.current.showDeferredCue).toBe(false);
    unmount();
  });

  it("erreur de lecture profil → pas de gate (≠ absence de profil)", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({
      ok: false,
      reason: "error",
    });
    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.loadError).toBeTruthy();
    expect(result.current.showGate).toBe(false);
    expect(result.current.showDeferredCue).toBe(false);
    expect(result.current.profile).toBeNull();
    unmount();
  });

  it("Plus tard → persiste deferred et ferme la gate", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({ ok: true, profile: null });
    vi.mocked(upsertMyUserProfile).mockResolvedValue({
      ok: true,
      profile: deferredProfile,
    });

    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showGate).toBe(true);

    await act(async () => {
      await result.current.defer();
    });

    expect(upsertMyUserProfile).toHaveBeenCalledWith({
      interests: [],
      availabilities: [],
      budget: "any",
      onboardingStatus: "deferred",
    });
    expect(result.current.profile?.onboardingStatus).toBe("deferred");
    expect(result.current.showGate).toBe(false);
    expect(result.current.showDeferredCue).toBe(true);
    unmount();
  });

  it("Passer pour l’instant en édition completed → ferme sans upsert deferred", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({
      ok: true,
      profile: completedProfile,
    });
    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });

    act(() => {
      result.current.openEditor();
    });
    expect(result.current.onboardingOpen).toBe(true);

    await act(async () => {
      const ok = await result.current.defer();
      expect(ok).toBe(true);
    });

    expect(upsertMyUserProfile).not.toHaveBeenCalled();
    expect(result.current.onboardingOpen).toBe(false);
    expect(result.current.profile).toEqual(completedProfile);
    expect(result.current.isConfigured).toBe(true);
    unmount();
  });

  it("reconnexion après deferred → pas de gate auto", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({
      ok: true,
      profile: deferredProfile,
    });
    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showGate).toBe(false);
    expect(result.current.showDeferredCue).toBe(true);
    unmount();
  });

  it("profil completed → pas d’onboarding auto, édition possible", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({
      ok: true,
      profile: completedProfile,
    });
    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showGate).toBe(false);
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.draft.interests).toEqual(["Cinéma"]);

    act(() => {
      result.current.openEditor();
    });
    expect(result.current.onboardingOpen).toBe(true);
    unmount();
  });

  it("reconnexion → préférences completed restaurées", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({
      ok: true,
      profile: completedProfile,
    });
    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.draft).toEqual({
      interests: ["Cinéma"],
      availabilities: ["weekend-day"],
      budget: "any",
    });
    expect(result.current.profile?.onboardingStatus).toBe("completed");
    unmount();
  });

  it("complete → persiste completed avec les choix", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({ ok: true, profile: null });
    vi.mocked(upsertMyUserProfile).mockResolvedValue({
      ok: true,
      profile: completedProfile,
    });

    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      const ok = await result.current.complete({
        interests: ["Cinéma"],
        availabilities: ["weekend-day"],
        budget: "any",
        onboardingStatus: "completed",
      });
      expect(ok).toBe(true);
    });

    expect(upsertMyUserProfile).toHaveBeenCalledWith({
      interests: ["Cinéma"],
      availabilities: ["weekend-day"],
      budget: "any",
      onboardingStatus: "completed",
    });
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.onboardingOpen).toBe(false);
    unmount();
  });

  it("erreur serveur à l’enregistrement → pas de faux succès", async () => {
    vi.mocked(getMyUserProfile).mockResolvedValue({ ok: true, profile: null });
    vi.mocked(upsertMyUserProfile).mockResolvedValue({
      ok: false,
      reason: "error",
    });

    const { result, unmount } = renderHook(() => usePersonalization(USER_ID));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.showGate).toBe(true);

    await act(async () => {
      const ok = await result.current.defer();
      expect(ok).toBe(false);
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.saveError).toBeTruthy();
    expect(result.current.showGate).toBe(true);
    unmount();
  });

  it("changement d’utilisateur → reset état, pas de fuite du profil précédent", async () => {
    vi.mocked(getMyUserProfile)
      .mockResolvedValueOnce({ ok: true, profile: completedProfile })
      .mockResolvedValueOnce({ ok: true, profile: completedProfileB });

    let currentUserId: string | null = USER_ID;
    const { result, rerender, unmount } = renderHook(() =>
      usePersonalization(currentUserId),
    );

    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.draft.interests).toEqual(["Cinéma"]);
    expect(result.current.isConfigured).toBe(true);

    act(() => {
      result.current.openEditor();
    });
    expect(result.current.onboardingOpen).toBe(true);

    currentUserId = USER_B;
    rerender();

    expect(result.current.profile).toBeNull();
    expect(result.current.onboardingOpen).toBe(false);
    expect(result.current.hydrated).toBe(false);
    expect(result.current.showGate).toBe(false);
    expect(result.current.draft.interests).toEqual([]);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(getMyUserProfile).toHaveBeenCalledTimes(2);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.draft.interests).toEqual(["Musique"]);
    expect(result.current.draft.budget).toBe("free_preferred");
    expect(result.current.profile?.userId).toBe(USER_B);
    unmount();
  });
});
