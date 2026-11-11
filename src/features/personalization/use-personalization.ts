"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMyUserProfile,
  upsertMyUserProfile,
} from "@/app/actions/user-profile";
import type {
  UserProfile,
  UserProfileWrite,
} from "@/domain/personalization/user-profile";

const EMPTY_DRAFT: Omit<UserProfileWrite, "onboardingStatus"> = {
  interests: [],
  availabilities: [],
  budget: "any",
};

export function usePersonalization(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(userId === null);
  /** Lecture aboutie (`ok: true`) — jamais true après une erreur serveur. */
  const [profileReady, setProfileReady] = useState(userId === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [trackedUserId, setTrackedUserId] = useState(userId);

  // Isolation session : reset synchrone si le compte change (pas de fuite UI).
  if (trackedUserId !== userId) {
    setTrackedUserId(userId);
    setProfile(null);
    setProfileReady(userId === null);
    setHydrated(userId === null);
    setLoadError(null);
    setSaveError(null);
    setBusy(false);
    setOnboardingOpen(false);
  }

  useEffect(() => {
    if (userId === null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await getMyUserProfile();
      if (cancelled) return;

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          setProfile(null);
          setLoadError(null);
          setProfileReady(false);
        } else {
          setLoadError("Impossible de charger vos préférences.");
          setProfileReady(false);
        }
        setHydrated(true);
        return;
      }

      setProfile(result.profile);
      setLoadError(null);
      setProfileReady(true);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileReady(true);
      setHydrated(true);
      setLoadError(null);
      return;
    }

    const result = await getMyUserProfile();
    if (!result.ok) {
      if (result.reason === "unauthenticated") {
        setProfile(null);
        setLoadError(null);
        setProfileReady(false);
      } else {
        setLoadError("Impossible de charger vos préférences.");
        setProfileReady(false);
      }
      setHydrated(true);
      return;
    }

    setProfile(result.profile);
    setLoadError(null);
    setProfileReady(true);
    setHydrated(true);
  }, [userId]);

  const save = useCallback(async (write: UserProfileWrite) => {
    setBusy(true);
    setSaveError(null);
    const result = await upsertMyUserProfile(write);
    setBusy(false);

    if (!result.ok) {
      setSaveError(
        result.reason === "invalid"
          ? "Vérifiez vos choix puis réessayez."
          : "Enregistrement impossible. Réessayez.",
      );
      return false;
    }

    setProfile(result.profile);
    setProfileReady(true);
    setOnboardingOpen(false);
    setSaveError(null);
    return true;
  }, []);

  const defer = useCallback(async () => {
    // Édition d’un profil déjà terminé : fermer sans écraser en `deferred`.
    if (profile?.onboardingStatus === "completed") {
      setOnboardingOpen(false);
      setSaveError(null);
      return true;
    }

    return save({
      ...EMPTY_DRAFT,
      onboardingStatus: "deferred",
    });
  }, [profile?.onboardingStatus, save]);

  const complete = useCallback(
    async (write: UserProfileWrite) => {
      return save({ ...write, onboardingStatus: "completed" });
    },
    [save],
  );

  const openEditor = useCallback(() => {
    setSaveError(null);
    setOnboardingOpen(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    if (busy) return;
    setOnboardingOpen(false);
    setSaveError(null);
  }, [busy]);

  const showGate =
    Boolean(userId) &&
    hydrated &&
    profileReady &&
    profile === null &&
    !onboardingOpen;
  const showDeferredCue =
    Boolean(userId) &&
    hydrated &&
    profileReady &&
    profile?.onboardingStatus === "deferred" &&
    !onboardingOpen;

  const draft = profile
    ? {
        interests: profile.interests,
        availabilities: profile.availabilities,
        budget: profile.budget,
      }
    : EMPTY_DRAFT;

  return {
    hydrated,
    profile,
    draft,
    loadError,
    saveError,
    busy,
    onboardingOpen,
    showGate,
    showDeferredCue,
    isConfigured: profile?.onboardingStatus === "completed",
    openEditor,
    closeOnboarding,
    defer,
    complete,
    refresh,
  };
}
