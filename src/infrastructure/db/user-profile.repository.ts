import "server-only";

import type {
  UserProfile,
  UserProfileWrite,
} from "@/domain/personalization/user-profile";
import { parseUserProfileWrite } from "@/domain/personalization/user-profile";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

type UserProfileSqlRow = {
  user_id: string;
  interests: string[] | null;
  availabilities: string[] | null;
  budget: string;
  onboarding_status: string;
  created_at: Date;
  updated_at: Date;
};

function mapUserProfileRow(row: UserProfileSqlRow): UserProfile {
  return {
    userId: row.user_id,
    interests: (row.interests ?? []) as UserProfile["interests"],
    availabilities: (row.availabilities ?? []) as UserProfile["availabilities"],
    budget: row.budget as UserProfile["budget"],
    onboardingStatus: row.onboarding_status as UserProfile["onboardingStatus"],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const USER_PROFILE_SELECT = `
SELECT
  user_id,
  interests,
  availabilities,
  budget,
  onboarding_status,
  created_at,
  updated_at
FROM user_profiles
`.trim();

/** Lecture profil — `null` si jamais créé (onboarding non traité). */
export async function getUserProfile(
  userId: string,
  client?: DbQueryable,
): Promise<UserProfile | null> {
  const result = await db(client).query<UserProfileSqlRow>(
    `
${USER_PROFILE_SELECT}
WHERE user_id = $1
`.trim(),
    [userId],
  );
  const row = result.rows[0];
  return row ? mapUserProfileRow(row) : null;
}

/**
 * Insert ou met à jour le profil du user (ownership = userId session).
 * Valide l’entrée via allowlists domaine avant écriture.
 */
export async function upsertUserProfile(
  userId: string,
  input: UserProfileWrite,
  client?: DbQueryable,
): Promise<UserProfile> {
  const parsed = parseUserProfileWrite(input);
  if (!parsed.ok) {
    throw new Error(`user_profile_invalid:${parsed.reason}`);
  }
  const value = parsed.value;

  const result = await db(client).query<UserProfileSqlRow>(
    `
INSERT INTO user_profiles (
  user_id,
  interests,
  availabilities,
  budget,
  onboarding_status
)
VALUES ($1, $2::text[], $3::text[], $4, $5)
ON CONFLICT (user_id) DO UPDATE SET
  interests = EXCLUDED.interests,
  availabilities = EXCLUDED.availabilities,
  budget = EXCLUDED.budget,
  onboarding_status = EXCLUDED.onboarding_status,
  updated_at = now()
RETURNING
  user_id,
  interests,
  availabilities,
  budget,
  onboarding_status,
  created_at,
  updated_at
`.trim(),
    [
      userId,
      value.interests,
      value.availabilities,
      value.budget,
      value.onboardingStatus,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("user_profile_upsert_failed");
  }
  return mapUserProfileRow(row);
}
