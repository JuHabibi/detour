/**
 * Persistance user_profiles — PGlite isolé (CRUD + CASCADE delete user).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { QueryResult, QueryResultRow } from "pg";
import {
  getUserProfile,
  upsertUserProfile,
} from "@/infrastructure/db/user-profile.repository";
import type { DbQueryable } from "@/infrastructure/db/postgres";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const SCHEMA_SQL = `
CREATE TABLE "user" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "email" text NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY
    REFERENCES "user" ("id") ON DELETE CASCADE,
  interests text[] NOT NULL DEFAULT '{}',
  availabilities text[] NOT NULL DEFAULT '{}',
  budget text NOT NULL DEFAULT 'any',
  onboarding_status text NOT NULL DEFAULT 'deferred',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_onboarding_status_check
    CHECK (onboarding_status IN ('deferred', 'completed')),
  CONSTRAINT user_profiles_budget_check
    CHECK (budget IN ('free_preferred', 'any')),
  CONSTRAINT user_profiles_interests_check
    CHECK (
      interests <@ ARRAY[
        'Musique',
        'Spectacle',
        'Cinéma',
        'Exposition',
        'Atelier',
        'Jeune public',
        'Rencontre',
        'Visite',
        'Fête / salon / marché',
        'Loisirs culturels'
      ]::text[]
    ),
  CONSTRAINT user_profiles_availabilities_check
    CHECK (
      availabilities <@ ARRAY[
        'weekday-evening',
        'weekend-day',
        'weekend-evening',
        'flexible'
      ]::text[]
    )
);
`.trim();

function createPgliteClient(pglite: PGlite): DbQueryable {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>> {
      const result = await pglite.query<T>(text, values ?? []);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length,
        command: "",
        oid: 0,
        fields: [],
      };
    },
  };
}

describe("user-profile.repository (PGlite)", () => {
  let pglite: PGlite;
  let client: DbQueryable;

  beforeAll(async () => {
    pglite = new PGlite();
    await pglite.exec(SCHEMA_SQL);
    client = createPgliteClient(pglite);
  });

  afterAll(async () => {
    await pglite.close();
  });

  beforeEach(async () => {
    await pglite.exec(`
DELETE FROM user_profiles;
DELETE FROM "user";
INSERT INTO "user" ("id", "name", "email", "emailVerified")
VALUES
  ('${USER_A}', 'Alice', 'alice@exemple.fr', true),
  ('${USER_B}', 'Bob', 'bob@exemple.fr', true);
`);
  });

  it("profil absent → null", async () => {
    await expect(getUserProfile(USER_A, client)).resolves.toBeNull();
  });

  it("crée puis lit un profil completed", async () => {
    const created = await upsertUserProfile(
      USER_A,
      {
        interests: ["Cinéma", "Exposition"],
        availabilities: ["weekend-day"],
        budget: "free_preferred",
        onboardingStatus: "completed",
      },
      client,
    );

    expect(created.userId).toBe(USER_A);
    expect(created.interests).toEqual(["Cinéma", "Exposition"]);
    expect(created.availabilities).toEqual(["weekend-day"]);
    expect(created.budget).toBe("free_preferred");
    expect(created.onboardingStatus).toBe("completed");

    const read = await getUserProfile(USER_A, client);
    expect(read).toEqual(created);
  });

  it("modifie un profil existant (upsert)", async () => {
    await upsertUserProfile(
      USER_A,
      {
        interests: [],
        availabilities: [],
        budget: "any",
        onboardingStatus: "deferred",
      },
      client,
    );

    const updated = await upsertUserProfile(
      USER_A,
      {
        interests: ["Musique"],
        availabilities: ["weekday-evening", "flexible"],
        budget: "any",
        onboardingStatus: "completed",
      },
      client,
    );

    expect(updated.onboardingStatus).toBe("completed");
    expect(updated.interests).toEqual(["Musique"]);
    expect(updated.availabilities).toEqual(["weekday-evening", "flexible"]);

    const rows = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM user_profiles WHERE user_id = $1`,
      [USER_A],
    );
    expect(rows.rows[0]?.count).toBe("1");
  });

  it("refuse completed sans intérêts avant SQL", async () => {
    await expect(
      upsertUserProfile(
        USER_A,
        {
          interests: [],
          availabilities: ["flexible"],
          budget: "any",
          onboardingStatus: "completed",
        },
        client,
      ),
    ).rejects.toThrow(/user_profile_invalid:completed_requires_interests/);

    await expect(getUserProfile(USER_A, client)).resolves.toBeNull();
  });

  it("DELETE user → cascade profil", async () => {
    await upsertUserProfile(
      USER_A,
      {
        interests: ["Atelier"],
        availabilities: ["flexible"],
        budget: "free_preferred",
        onboardingStatus: "completed",
      },
      client,
    );
    await upsertUserProfile(
      USER_B,
      {
        interests: ["Visite"],
        availabilities: ["weekend-evening"],
        budget: "any",
        onboardingStatus: "completed",
      },
      client,
    );

    await client.query(`DELETE FROM "user" WHERE "id" = $1`, [USER_A]);

    await expect(getUserProfile(USER_A, client)).resolves.toBeNull();
    await expect(getUserProfile(USER_B, client)).resolves.not.toBeNull();
  });

  it("CHECK SQL rejette un intérêt hors allowlist", async () => {
    await expect(
      client.query(
        `
INSERT INTO user_profiles (user_id, interests, availabilities, budget, onboarding_status)
VALUES ($1, $2::text[], $3::text[], $4, $5)
`.trim(),
        [USER_A, ["Autre"], ["flexible"], "any", "completed"],
      ),
    ).rejects.toThrow();
  });
});
