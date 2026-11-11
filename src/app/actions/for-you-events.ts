"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { getForYouRecommendations } from "@/application/personalization/get-for-you-recommendations";
import type { EventItem } from "@/data/types";
import { getUserProfile } from "@/infrastructure/db/user-profile.repository";
import { forYouPerfEnd, forYouPerfMark } from "@/lib/perf-for-you";

export type GetMyForYouEventsResult =
  | {
      ok: true;
      events: EventItem[];
    }
  | {
      ok: false;
      reason: "unauthenticated" | "error";
    };

/**
 * Sélection « Pour vous » pour la session authentifiée.
 * Source de vérité = profil PostgreSQL de la session — aucun userId / prefs client.
 * Hors cache public Home / ISR.
 */
export async function getMyForYouEvents(): Promise<GetMyForYouEventsResult> {
  const total = forYouPerfMark("getMyForYouEvents.total");

  const authMark = forYouPerfMark("getMyForYouEvents.auth");
  const auth = await getAccountAuthState();
  forYouPerfEnd(authMark, { status: auth.status });
  if (auth.status !== "authenticated") {
    forYouPerfEnd(total, { ok: false, reason: "unauthenticated" });
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const profileMark = forYouPerfMark("getMyForYouEvents.profile");
    const profile = await getUserProfile(auth.user.id);
    forYouPerfEnd(profileMark, {
      hasProfile: profile != null,
      status: profile?.onboardingStatus ?? null,
      interests: profile?.interests.length ?? 0,
    });

    if (
      !profile ||
      profile.onboardingStatus !== "completed" ||
      profile.interests.length === 0
    ) {
      forYouPerfEnd(total, { ok: true, events: 0, reason: "not_configured" });
      return { ok: true, events: [] };
    }

    const recMark = forYouPerfMark("getMyForYouEvents.recommendations");
    const result = await getForYouRecommendations({
      interests: profile.interests,
      availabilities: profile.availabilities,
      budget: profile.budget,
    });
    forYouPerfEnd(recMark, {
      candidates: result.candidateCount,
      selected: result.events.length,
      interests: profile.interests.length,
    });
    forYouPerfEnd(total, { ok: true, events: result.events.length });
    return { ok: true, events: result.events };
  } catch (error) {
    console.error("[detour:for-you] getMyForYouEvents failed", error);
    forYouPerfEnd(total, { ok: false, reason: "error" });
    return { ok: false, reason: "error" };
  }
}
