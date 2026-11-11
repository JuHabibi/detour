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
  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const profile = await getUserProfile(auth.user.id);
    return { ok: true, profile };
  } catch (error) {
    console.error("[detour:user-profile] getMyUserProfile failed", error);
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
