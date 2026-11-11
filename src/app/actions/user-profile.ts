"use server";

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  parseUserProfileWrite,
  type UserProfile,
} from "@/domain/personalization/user-profile";
import {
  getUserProfile,
  upsertUserProfile,
} from "@/infrastructure/db/user-profile.repository";
import { forYouPerfEnd, forYouPerfMark } from "@/lib/perf-for-you";

export type GetMyUserProfileResult =
  | { ok: true; profile: UserProfile | null }
  | { ok: false; reason: "unauthenticated" | "error" };

export type UpsertMyUserProfileResult =
  | { ok: true; profile: UserProfile }
  | {
      ok: false;
      reason: "unauthenticated" | "invalid" | "error";
      /** Raison domaine (`parseUserProfileWrite`) — absente hors `invalid`. */
      details?: string;
    };

/**
 * Profil culturel de la session courante.
 * Aucun userId client — `null` si le profil n’existe pas encore.
 */
export async function getMyUserProfile(): Promise<GetMyUserProfileResult> {
  const total = forYouPerfMark("getMyUserProfile.total");
  const authMark = forYouPerfMark("getMyUserProfile.auth");
  const auth = await getAccountAuthState();
  forYouPerfEnd(authMark, { status: auth.status });
  if (auth.status !== "authenticated") {
    forYouPerfEnd(total, { ok: false, reason: "unauthenticated" });
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const profileMark = forYouPerfMark("getMyUserProfile.db");
    const profile = await getUserProfile(auth.user.id);
    forYouPerfEnd(profileMark, {
      hasProfile: profile != null,
      status: profile?.onboardingStatus ?? null,
    });
    forYouPerfEnd(total, { ok: true });
    return { ok: true, profile };
  } catch (error) {
    console.error("[detour:user-profile] getMyUserProfile failed", error);
    forYouPerfEnd(total, { ok: false, reason: "error" });
    return { ok: false, reason: "error" };
  }
}

/**
 * Enregistre les préférences culturelles de la session courante.
 * Payload validé via `parseUserProfileWrite` — jamais de userId client.
 *
 * Cas V1 :
 * - `deferred` + prefs vides → « Plus tard »
 * - `completed` + ≥1 intérêt → onboarding terminé
 */
export async function upsertMyUserProfile(
  input: unknown,
): Promise<UpsertMyUserProfileResult> {
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  const parsed = parseUserProfileWrite(input);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid", details: parsed.reason };
  }

  try {
    const profile = await upsertUserProfile(auth.user.id, parsed.value);
    return { ok: true, profile };
  } catch (error) {
    console.error("[detour:user-profile] upsertMyUserProfile failed", error);
    return { ok: false, reason: "error" };
  }
}
