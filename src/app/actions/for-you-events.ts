"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { getForYouRecommendations } from "@/application/personalization/get-for-you-recommendations";
import type { EventItem } from "@/data/types";
import { getUserProfile } from "@/infrastructure/db/user-profile.repository";

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
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const profile = await getUserProfile(auth.user.id);
    if (
      !profile ||
      profile.onboardingStatus !== "completed" ||
      profile.interests.length === 0
    ) {
      return { ok: true, events: [] };
    }

    const result = await getForYouRecommendations({
      interests: profile.interests,
      availabilities: profile.availabilities,
      budget: profile.budget,
    });
    return { ok: true, events: result.events };
  } catch (error) {
    console.error("[detour:for-you] getMyForYouEvents failed", error);
    return { ok: false, reason: "error" };
  }
}
