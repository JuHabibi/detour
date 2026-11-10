import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/infrastructure/db/user-profile.repository", () => ({
  getUserProfile: vi.fn(),
  upsertUserProfile: vi.fn(),
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  getMyUserProfile,
  upsertMyUserProfile,
} from "@/app/actions/user-profile";
import * as userProfileRepository from "@/infrastructure/db/user-profile.repository";
import type { UserProfile } from "@/domain/personalization/user-profile";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const sampleProfile: UserProfile = {
  userId: USER_ID,
  interests: ["Cinéma"],
  availabilities: ["weekend-day"],
  budget: "free_preferred",
  onboardingStatus: "completed",
  createdAt: "2026-11-10T10:00:00.000Z",
  updatedAt: "2026-11-10T11:00:00.000Z",
};

describe("user-profile actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyUserProfile", () => {
    it("unauthenticated → pas de repository", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "unauthenticated",
      });

      await expect(getMyUserProfile()).resolves.toEqual({
        ok: false,
        reason: "unauthenticated",
      });
      expect(userProfileRepository.getUserProfile).not.toHaveBeenCalled();
    });

    it("authenticated sans profil → null (pas de création)", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "authenticated",
        user: { id: USER_ID, email: "a@exemple.fr", name: "A" },
      });
      vi.mocked(userProfileRepository.getUserProfile).mockResolvedValue(null);

      await expect(getMyUserProfile()).resolves.toEqual({
        ok: true,
        profile: null,
      });
      expect(userProfileRepository.getUserProfile).toHaveBeenCalledWith(USER_ID);
      expect(userProfileRepository.upsertUserProfile).not.toHaveBeenCalled();
    });

    it("authenticated avec profil → profil scopé session", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "authenticated",
        user: { id: USER_ID, email: "a@exemple.fr", name: "A" },
      });
      vi.mocked(userProfileRepository.getUserProfile).mockResolvedValue(
        sampleProfile,
      );

      await expect(getMyUserProfile()).resolves.toEqual({
        ok: true,
        profile: sampleProfile,
      });
      expect(userProfileRepository.getUserProfile).toHaveBeenCalledWith(USER_ID);
    });

    it("signature publique sans userId client", () => {
      expect(getMyUserProfile.length).toBe(0);
    });
  });

  describe("upsertMyUserProfile", () => {
    it("unauthenticated → ne persiste pas", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "unauthenticated",
      });

      await expect(
        upsertMyUserProfile({
          interests: ["Musique"],
          availabilities: ["flexible"],
          budget: "any",
          onboardingStatus: "completed",
        }),
      ).resolves.toEqual({ ok: false, reason: "unauthenticated" });
      expect(userProfileRepository.upsertUserProfile).not.toHaveBeenCalled();
    });

    it("Plus tard → deferred avec préférences vides", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "authenticated",
        user: { id: USER_ID, email: "a@exemple.fr", name: "A" },
      });
      const deferredProfile: UserProfile = {
        ...sampleProfile,
        interests: [],
        availabilities: [],
        budget: "any",
        onboardingStatus: "deferred",
      };
      vi.mocked(userProfileRepository.upsertUserProfile).mockResolvedValue(
        deferredProfile,
      );

      await expect(
        upsertMyUserProfile({
          interests: [],
          availabilities: [],
          budget: "any",
          onboardingStatus: "deferred",
        }),
      ).resolves.toEqual({ ok: true, profile: deferredProfile });

      expect(userProfileRepository.upsertUserProfile).toHaveBeenCalledWith(
        USER_ID,
        {
          interests: [],
          availabilities: [],
          budget: "any",
          onboardingStatus: "deferred",
        },
      );
    });

    it("onboarding terminé → completed avec intérêts", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "authenticated",
        user: { id: USER_ID, email: "a@exemple.fr", name: "A" },
      });
      vi.mocked(userProfileRepository.upsertUserProfile).mockResolvedValue(
        sampleProfile,
      );

      await expect(
        upsertMyUserProfile({
          interests: ["Cinéma"],
          availabilities: ["weekend-day"],
          budget: "free_preferred",
          onboardingStatus: "completed",
        }),
      ).resolves.toEqual({ ok: true, profile: sampleProfile });

      expect(userProfileRepository.upsertUserProfile).toHaveBeenCalledWith(
        USER_ID,
        {
          interests: ["Cinéma"],
          availabilities: ["weekend-day"],
          budget: "free_preferred",
          onboardingStatus: "completed",
        },
      );
    });

    it("completed sans intérêt → invalid, pas d’écriture", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "authenticated",
        user: { id: USER_ID, email: "a@exemple.fr", name: "A" },
      });

      await expect(
        upsertMyUserProfile({
          interests: [],
          availabilities: ["flexible"],
          budget: "any",
          onboardingStatus: "completed",
        }),
      ).resolves.toEqual({
        ok: false,
        reason: "invalid",
        details: "completed_requires_interests",
      });
      expect(userProfileRepository.upsertUserProfile).not.toHaveBeenCalled();
    });

    it("valeurs hors allowlist → invalid", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "authenticated",
        user: { id: USER_ID, email: "a@exemple.fr", name: "A" },
      });

      await expect(
        upsertMyUserProfile({
          interests: ["Spectacle"],
          availabilities: ["flexible"],
          budget: "under-15",
          onboardingStatus: "completed",
        }),
      ).resolves.toEqual({
        ok: false,
        reason: "invalid",
        details: "invalid_budget",
      });
      expect(userProfileRepository.upsertUserProfile).not.toHaveBeenCalled();
    });

    it("utilise uniquement le userId de session", async () => {
      vi.mocked(getAccountAuthState).mockResolvedValue({
        status: "authenticated",
        user: { id: USER_ID, email: "a@exemple.fr", name: "A" },
      });
      vi.mocked(userProfileRepository.upsertUserProfile).mockResolvedValue(
        sampleProfile,
      );

      await upsertMyUserProfile({
        interests: ["Cinéma"],
        availabilities: ["flexible"],
        budget: "any",
        onboardingStatus: "completed",
        userId: "evil-client-id",
      });

      expect(userProfileRepository.upsertUserProfile).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ onboardingStatus: "completed" }),
      );
      expect(userProfileRepository.upsertUserProfile).not.toHaveBeenCalledWith(
        "evil-client-id",
        expect.anything(),
      );
    });
  });
});
