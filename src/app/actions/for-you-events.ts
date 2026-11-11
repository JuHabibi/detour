"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { getForYouRecommendations } from "@/application/personalization/get-for-you-recommendations";
import type { EventItem } from "@/data/types";
import { parseForYouPreferences } from "@/domain/personalization/parse-for-you-preferences";

export type GetMyForYouEventsResult =
  | {
      ok: true;
      events: EventItem[];
    }
  | {
      ok: false;
      reason: "unauthenticated" | "invalid" | "error";
    };

/**
 * Sélection « Pour vous » pour la session authentifiée.
 * Aucun `userId` client — la session borne l’accès ; les préférences
 * (déjà chargées via `getMyUserProfile`) sont revalidées ici.
 * Hors cache public Home / ISR.
 */
export async function getMyForYouEvents(
  preferences: unknown,
): Promise<GetMyForYouEventsResult> {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  const parsed = parseForYouPreferences(preferences);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const result = await getForYouRecommendations(parsed.value);
    return { ok: true, events: result.events };
  } catch (error) {
    console.error("[detour:for-you] getMyForYouEvents failed", error);
    return { ok: false, reason: "error" };
  }
}
