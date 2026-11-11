"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { getForYouRecommendations } from "@/application/personalization/get-for-you-recommendations";
import type { EventItem } from "@/data/types";
import type { UserProfile } from "@/domain/personalization/user-profile";
import { getUserProfile } from "@/infrastructure/db/user-profile.repository";
import { forYouPerfEnd, forYouPerfMark } from "@/lib/perf-for-you";

export type ForYouBundleState =
  | { status: "not_configured"; events: [] }
  | { status: "empty"; events: [] }
  | { status: "ready"; events: EventItem[] }
  | { status: "error"; events: [] };

export type GetMyPersonalizationHomeResult =
  | {
      ok: true;
      profile: UserProfile | null;
      forYou: ForYouBundleState;
    }
  | { ok: false; reason: "unauthenticated" | "error" };

/**
 * Chargement privé Home : 1 auth + 1 profil + recommandations si completed.
 * Une erreur Explorer n’empêche pas le retour du profil (pas de fausse gate).
 * Hors cache public Home / ISR.
 */
export async function getMyPersonalizationHome(): Promise<GetMyPersonalizationHomeResult> {
  const total = forYouPerfMark("getMyPersonalizationHome.total");

  const authMark = forYouPerfMark("getMyPersonalizationHome.auth");
  const auth = await getAccountAuthState();
  forYouPerfEnd(authMark, { status: auth.status });
  if (auth.status !== "authenticated") {
    forYouPerfEnd(total, { ok: false, reason: "unauthenticated" });
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const profileMark = forYouPerfMark("getMyPersonalizationHome.profile");
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
      forYouPerfEnd(total, {
        ok: true,
        forYou: "not_configured",
      });
      return {
        ok: true,
        profile,
        forYou: { status: "not_configured", events: [] },
      };
    }

    try {
      const recMark = forYouPerfMark("getMyPersonalizationHome.recommendations");
      const result = await getForYouRecommendations({
        interests: profile.interests,
        availabilities: profile.availabilities,
        budget: profile.budget,
      });
      forYouPerfEnd(recMark, {
        candidates: result.candidateCount,
        selected: result.events.length,
      });

      const forYou: ForYouBundleState =
        result.events.length === 0
          ? { status: "empty", events: [] }
          : { status: "ready", events: result.events };

      forYouPerfEnd(total, {
        ok: true,
        forYou: forYou.status,
        events: result.events.length,
      });
      return { ok: true, profile, forYou };
    } catch (explorerError) {
      console.error(
        "[detour:personalization-home] Explorer recommendations failed",
        explorerError,
      );
      forYouPerfEnd(total, { ok: true, forYou: "error" });
      return {
        ok: true,
        profile,
        forYou: { status: "error", events: [] },
      };
    }
  } catch (error) {
    console.error("[detour:personalization-home] getMyPersonalizationHome failed", error);
    forYouPerfEnd(total, { ok: false, reason: "error" });
    return { ok: false, reason: "error" };
  }
}
