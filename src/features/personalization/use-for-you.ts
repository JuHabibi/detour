"use client";

import { useEffect, useRef, useState } from "react";
import { getMyForYouEvents } from "@/app/actions/for-you-events";
import type { EventItem } from "@/data/types";
import type { UserProfile } from "@/domain/personalization/user-profile";
import { forYouPerfEnd, forYouPerfLog, forYouPerfMark } from "@/lib/perf-for-you";

export type ForYouLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; events: EventItem[] }
  | { status: "empty" }
  | { status: "not_configured" }
  | { status: "error" };

/**
 * Charge la sélection privée « Pour vous » lorsque le profil client est `completed`.
 * Les préférences effectives sont lues côté serveur (profil persisté).
 * `preferenceKey` ne sert qu’à rafraîchir après une modification locale du profil.
 */
export function useForYou(
  userId: string | null,
  profile: UserProfile | null,
  profileReady: boolean,
) {
  const [state, setState] = useState<ForYouLoadState>({ status: "idle" });
  const [trackedUserId, setTrackedUserId] = useState(userId);
  const preferenceKey = profilePreferenceKey(profile);
  const profileRef = useRef(profile);
  const requestIdRef = useRef(0);

  if (trackedUserId !== userId) {
    setTrackedUserId(userId);
    setState({ status: "idle" });
  }

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled || requestId !== requestIdRef.current) return;

      const current = profileRef.current;

      if (!userId || !profileReady) {
        setState({ status: "idle" });
        return;
      }

      if (!current || current.onboardingStatus !== "completed") {
        setState({ status: "not_configured" });
        return;
      }

      if (current.interests.length === 0) {
        setState({ status: "empty" });
        return;
      }

      setState({ status: "loading" });
      forYouPerfLog("client.profileReady→forYou.start", {
        preferenceKey,
      });
      const mark = forYouPerfMark("client.getMyForYouEvents");
      const result = await getMyForYouEvents();
      forYouPerfEnd(mark, {
        ok: result.ok,
        events: result.ok ? result.events.length : null,
      });
      if (result.ok && result.events.length > 0) {
        forYouPerfLog("client.carousel.ready");
      }

      if (cancelled || requestId !== requestIdRef.current) return;

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          setState({ status: "not_configured" });
          return;
        }
        setState({ status: "error" });
        return;
      }

      if (result.events.length === 0) {
        setState({ status: "empty" });
        return;
      }

      setState({ status: "ready", events: result.events });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profileReady, preferenceKey]);

  const refresh = () => {
    const requestId = ++requestIdRef.current;
    void (async () => {
      await Promise.resolve();
      if (requestId !== requestIdRef.current) return;

      const current = profileRef.current;

      if (!userId || !profileReady) {
        setState({ status: "idle" });
        return;
      }
      if (!current || current.onboardingStatus !== "completed") {
        setState({ status: "not_configured" });
        return;
      }
      if (current.interests.length === 0) {
        setState({ status: "empty" });
        return;
      }

      setState({ status: "loading" });
      const result = await getMyForYouEvents();
      if (requestId !== requestIdRef.current) return;

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          setState({ status: "not_configured" });
          return;
        }
        setState({ status: "error" });
        return;
      }

      if (result.events.length === 0) {
        setState({ status: "empty" });
        return;
      }

      setState({ status: "ready", events: result.events });
    })();
  };

  return {
    state,
    refresh,
  };
}

function profilePreferenceKey(profile: UserProfile | null): string {
  if (!profile || profile.onboardingStatus !== "completed") {
    return "none";
  }
  return [
    profile.updatedAt,
    profile.budget,
    profile.interests.join(","),
    profile.availabilities.join(","),
  ].join("|");
}
