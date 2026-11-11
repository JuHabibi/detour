"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMyForYouEvents } from "@/app/actions/for-you-events";
import { getMyPersonalizationHome } from "@/app/actions/personalization-home";
import {
  upsertMyUserProfile,
} from "@/app/actions/user-profile";
import type { EventItem } from "@/data/types";
import type {
  UserProfile,
  UserProfileWrite,
} from "@/domain/personalization/user-profile";
import { forYouPerfEnd, forYouPerfLog, forYouPerfMark } from "@/lib/perf-for-you";
import type { ForYouLoadState } from "./use-for-you";

const EMPTY_DRAFT: Omit<UserProfileWrite, "onboardingStatus"> = {
  interests: [],
  availabilities: [],
  budget: "any",
};

/**
 * Orchestration Home : un seul round-trip initial (profil + Pour vous).
 * `getMyUserProfile` reste pour le compte / hors Home.
 */
export function usePersonalizationHome(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(userId === null);
  const [profileReady, setProfileReady] = useState(userId === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [forYouState, setForYouState] = useState<ForYouLoadState>({
    status: "idle",
  });
  const [trackedUserId, setTrackedUserId] = useState(userId);
  const profileRef = useRef(profile);
  const forYouRequestIdRef = useRef(0);

  if (trackedUserId !== userId) {
    setTrackedUserId(userId);
    setProfile(null);
    setProfileReady(userId === null);
    setHydrated(userId === null);
    setLoadError(null);
    setSaveError(null);
    setBusy(false);
    setOnboardingOpen(false);
    setForYouState({ status: "idle" });
  }

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (userId === null) {
      return;
    }

    let cancelled = false;
    const requestId = ++forYouRequestIdRef.current;

    void (async () => {
      forYouPerfLog("client.homeBundle.start");
      const mark = forYouPerfMark("client.getMyPersonalizationHome");
      setForYouState({ status: "loading" });
      const result = await getMyPersonalizationHome();
      forYouPerfEnd(mark, {
        ok: result.ok,
        forYou: result.ok ? result.forYou.status : result.reason,
      });
      if (cancelled || requestId !== forYouRequestIdRef.current) return;

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          setProfile(null);
          setLoadError(null);
          setProfileReady(false);
          setForYouState({ status: "not_configured" });
        } else {
          setLoadError("Impossible de charger vos préférences.");
          setProfileReady(false);
          setForYouState({ status: "error" });
        }
        setHydrated(true);
        return;
      }

      setProfile(result.profile);
      setLoadError(null);
      setProfileReady(true);
      setHydrated(true);
      setForYouState(mapBundleForYou(result.forYou));
      if (result.forYou.status === "ready") {
        forYouPerfLog("client.carousel.ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshForYou = useCallback(async () => {
    const requestId = ++forYouRequestIdRef.current;
    const current = profileRef.current;

    if (!userId || !current || current.onboardingStatus !== "completed") {
      setForYouState({ status: "not_configured" });
      return;
    }
    if (current.interests.length === 0) {
      setForYouState({ status: "empty" });
      return;
    }

    setForYouState({ status: "loading" });
    const mark = forYouPerfMark("client.refreshForYou");
    const result = await getMyForYouEvents();
    forYouPerfEnd(mark, {
      ok: result.ok,
      events: result.ok ? result.events.length : null,
    });
    if (requestId !== forYouRequestIdRef.current) return;

    if (!result.ok) {
      if (result.reason === "unauthenticated") {
        setForYouState({ status: "not_configured" });
        return;
      }
      setForYouState({ status: "error" });
      return;
    }

    setForYouState(
      result.events.length === 0
        ? { status: "empty" }
        : { status: "ready", events: result.events },
    );
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileReady(true);
      setHydrated(true);
      setLoadError(null);
      setForYouState({ status: "idle" });
      return;
    }

    const requestId = ++forYouRequestIdRef.current;
    setForYouState({ status: "loading" });
    const result = await getMyPersonalizationHome();
    if (requestId !== forYouRequestIdRef.current) return;

    if (!result.ok) {
      if (result.reason === "unauthenticated") {
        setProfile(null);
        setLoadError(null);
        setProfileReady(false);
        setForYouState({ status: "not_configured" });
      } else {
        setLoadError("Impossible de charger vos préférences.");
        setProfileReady(false);
        setForYouState({ status: "error" });
      }
      setHydrated(true);
      return;
    }

    setProfile(result.profile);
    setLoadError(null);
    setProfileReady(true);
    setHydrated(true);
    setForYouState(mapBundleForYou(result.forYou));
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

    if (result.profile.onboardingStatus === "completed") {
      await refreshForYou();
    } else {
      setForYouState({ status: "not_configured" });
    }
    return true;
  }, [refreshForYou]);

  const defer = useCallback(async () => {
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
    profileReady,
    profile,
    draft,
    loadError,
    saveError,
    busy,
    onboardingOpen,
    showGate,
    showDeferredCue,
    isConfigured: profile?.onboardingStatus === "completed",
    forYouState,
    openEditor,
    closeOnboarding,
    defer,
    complete,
    refresh,
    refreshForYou,
  };
}

function mapBundleForYou(forYou: {
  status: string;
  events: EventItem[];
}): ForYouLoadState {
  if (forYou.status === "ready") {
    return { status: "ready", events: forYou.events };
  }
  if (forYou.status === "empty") return { status: "empty" };
  if (forYou.status === "error") return { status: "error" };
  return { status: "not_configured" };
}
