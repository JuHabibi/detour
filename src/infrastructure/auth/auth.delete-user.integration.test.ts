import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely";
import type { Pool } from "pg";
import {
  ACCOUNT_DELETED_CALLBACK_PATH,
  ACCOUNT_DELETED_FLASH_COOKIE,
} from "@/features/account/components/auth/account-deleted-path";
import { createAuth } from "@/infrastructure/auth/create-auth";
import { deleteVerificationTokensForUser } from "@/infrastructure/auth/delete-user-verification-cleanup";
import { finalizeDeleteUserCallbackResponse } from "@/infrastructure/auth/finalize-delete-user-callback-response";

const AUTH_BASE_URL = "http://localhost:3003";
const AUTH_SECRET = "test-secret-at-least-32-characters-long!!";
const PASSWORD = "password1";
const EMAIL = "delete-me@exemple.fr";
const EVENT_ID = "event-public-keep";
const EVENT_OTHER = "event-public-other";

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
CREATE UNIQUE INDEX "user_email_uidx" ON "user" ("email");

CREATE TABLE "session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text NULL,
  "userAgent" text NULL,
  "userId" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "session_token_uidx" ON "session" ("token");

CREATE TABLE "account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" text NULL,
  "refreshToken" text NULL,
  "idToken" text NULL,
  "accessTokenExpiresAt" timestamptz NULL,
  "refreshTokenExpiresAt" timestamptz NULL,
  "scope" text NULL,
  "password" text NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "verification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "rateLimit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" text NOT NULL,
  "count" integer NOT NULL,
  "lastRequest" bigint NOT NULL
);
CREATE UNIQUE INDEX "rateLimit_key_uidx" ON "rateLimit" ("key");

CREATE TABLE events (
  id text PRIMARY KEY,
  adapter_id text NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  UNIQUE (user_id, event_id)
);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  name text NOT NULL,
  CONSTRAINT groups_name_not_blank CHECK (char_length(btrim(name)) > 0)
);

CREATE TABLE group_events (
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, event_id)
);
`;

function cookieHeaderFromResponse(response: Response): string {
  const fromGetSetCookie =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const raw =
    fromGetSetCookie.length > 0
      ? fromGetSetCookie
      : [response.headers.get("set-cookie")].filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        );

  const pairs = raw
    .flatMap((header) => header.split(/,(?=\s*[^;]+=[^;]+)/))
    .map((part) => part.trim().split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair) && pair.includes("="));

  if (pairs.length === 0) {
    throw new Error("Expected session Set-Cookie from Better Auth");
  }
  return pairs.join("; ");
}

describe("auth deleteUser integration (PGlite)", () => {
  let db: PGlite;
  let poolLike: Pool;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA_SQL);
    poolLike = {
      query: async (text: string, values?: unknown[]) => {
        const result = await db.query(text, values ?? []);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length,
        };
      },
    } as Pool;
  });

  afterAll(async () => {
    await db.close();
  });

  it("confirmation email → cascades perso + events publics conservés + sessions/jeton invalidés", async () => {
    const capture: {
      current: { url: string; token: string } | null;
    } = { current: null };

    const auth = createAuth({
      database: {
        dialect: new PGliteDialect({ pglite: db }),
        type: "postgres",
      },
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
      plugins: [],
      rateLimit: { enabled: false },
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        // Session immédiate pour le parcours delete (hors prod).
        requireEmailVerification: false,
        sendResetPassword: async () => undefined,
      },
      emailVerification: {
        sendVerificationEmail: async () => undefined,
        sendOnSignIn: false,
        autoSignInAfterVerification: false,
      },
      user: {
        deleteUser: {
          enabled: true,
          deleteTokenExpiresIn: 60 * 60 * 24,
          sendDeleteAccountVerification: async ({ url, token }) => {
            capture.current = { url, token };
          },
          beforeDelete: async (user) => {
            await deleteVerificationTokensForUser(poolLike, user.id);
          },
        },
      },
    });

    const signUp = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          name: "À supprimer",
          email: EMAIL,
          password: PASSWORD,
        }),
      }),
    );
    expect(signUp.status).toBe(200);
    const cookie = cookieHeaderFromResponse(signUp);

    const userRow = await db.query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = $1`,
      [EMAIL],
    );
    const userId = userRow.rows[0]?.id;
    expect(userId).toBeTruthy();

    // Deuxième session (autre appareil) + provider Google lié.
    await db.query(
      `INSERT INTO "session" (id, "expiresAt", token, "userId")
       VALUES (gen_random_uuid(), now() + interval '7 days', $1, $2)`,
      ["stale-session-token-other-device", userId],
    );
    await db.query(
      `INSERT INTO "account" (id, "accountId", "providerId", "userId")
       VALUES (gen_random_uuid(), $1, 'google', $2)`,
      ["google-sub-delete-test", userId],
    );

    // Événements publics + données perso.
    await db.query(
      `INSERT INTO events (id, adapter_id, title, start_at, last_seen_at)
       VALUES ($1, 'test', 'Concert public', now(), now()),
              ($2, 'test', 'Expo publique', now(), now())`,
      [EVENT_ID, EVENT_OTHER],
    );
    await db.query(
      `INSERT INTO favorites (user_id, event_id) VALUES ($1, $2)`,
      [userId, EVENT_ID],
    );
    const group = await db.query<{ id: string }>(
      `INSERT INTO groups (user_id, name) VALUES ($1, $2) RETURNING id`,
      [userId, "Mon carnet"],
    );
    const groupId = group.rows[0]?.id;
    expect(groupId).toBeTruthy();
    await db.query(
      `INSERT INTO group_events (group_id, event_id) VALUES ($1, $2)`,
      [groupId, EVENT_ID],
    );

    // Jeton reset lié au user (doit disparaître au beforeDelete).
    await db.query(
      `INSERT INTO "verification" (id, identifier, value, "expiresAt")
       VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour')`,
      [`reset-password:orphan-for-${userId}`, userId],
    );

    const beforeSessions = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "session" WHERE "userId" = $1`,
      [userId],
    );
    expect(beforeSessions.rows[0]?.n).toBeGreaterThanOrEqual(2);

    const deleteRequest = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/delete-user`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
          cookie,
        },
        body: JSON.stringify({
          password: PASSWORD,
          // Identique à AccountDangerZone.
          callbackURL: ACCOUNT_DELETED_CALLBACK_PATH,
        }),
      }),
    );
    expect(deleteRequest.status).toBe(200);
    const deleteBody = (await deleteRequest.json()) as {
      success: boolean;
      message: string;
    };
    expect(deleteBody).toEqual({
      success: true,
      message: "Verification email sent",
    });
    if (!capture.current) {
      throw new Error("expected delete-account verification payload");
    }
    const deleteVerification = capture.current;
    expect(deleteVerification.token.length).toBeGreaterThan(0);
    expect(deleteVerification.url).toContain("/delete-user/callback?token=");

    // Compte encore présent avant confirmation.
    const stillThere = await db.query(
      `SELECT count(*)::int AS n FROM "user" WHERE id = $1`,
      [userId],
    );
    expect(stillThere.rows[0]).toEqual({ n: 1 });

    const callback = await auth.handler(
      new Request(deleteVerification.url, {
        method: "GET",
        headers: {
          origin: AUTH_BASE_URL,
          cookie,
        },
      }),
    );
    // BA 1.7.4 + callbackURL AccountDangerZone → 3xx Location=/account/deleted.
    expect(callback.status).toBeGreaterThanOrEqual(300);
    expect(callback.status).toBeLessThan(400);
    const baLocation = callback.headers.get("Location") ?? "";
    expect(
      baLocation === ACCOUNT_DELETED_CALLBACK_PATH ||
        baLocation.endsWith(ACCOUNT_DELETED_CALLBACK_PATH),
    ).toBe(true);

    const finalized = finalizeDeleteUserCallbackResponse(
      callback,
      AUTH_BASE_URL,
    );
    expect(finalized.headers.get("Location")).toBe(
      `${AUTH_BASE_URL}${ACCOUNT_DELETED_CALLBACK_PATH}`,
    );
    const finalizedCookies =
      typeof finalized.headers.getSetCookie === "function"
        ? finalized.headers.getSetCookie()
        : [];
    expect(
      finalizedCookies.some((c) =>
        c.startsWith(`${ACCOUNT_DELETED_FLASH_COOKIE}=1`),
      ),
    ).toBe(true);

    const users = await db.query(
      `SELECT count(*)::int AS n FROM "user" WHERE id = $1`,
      [userId],
    );
    const accounts = await db.query(
      `SELECT count(*)::int AS n FROM "account" WHERE "userId" = $1`,
      [userId],
    );
    const sessions = await db.query(
      `SELECT count(*)::int AS n FROM "session" WHERE "userId" = $1`,
      [userId],
    );
    const favorites = await db.query(
      `SELECT count(*)::int AS n FROM favorites WHERE user_id = $1`,
      [userId],
    );
    const groups = await db.query(
      `SELECT count(*)::int AS n FROM groups WHERE user_id = $1`,
      [userId],
    );
    const groupEvents = await db.query(
      `SELECT count(*)::int AS n FROM group_events WHERE group_id = $1`,
      [groupId],
    );
    const verifications = await db.query(
      `SELECT count(*)::int AS n FROM "verification" WHERE value = $1`,
      [userId],
    );
    const events = await db.query<{ id: string }>(
      `SELECT id FROM events ORDER BY id`,
    );

    expect(users.rows[0]).toEqual({ n: 0 });
    expect(accounts.rows[0]).toEqual({ n: 0 });
    expect(sessions.rows[0]).toEqual({ n: 0 });
    expect(favorites.rows[0]).toEqual({ n: 0 });
    expect(groups.rows[0]).toEqual({ n: 0 });
    expect(groupEvents.rows[0]).toEqual({ n: 0 });
    expect(verifications.rows[0]).toEqual({ n: 0 });
    expect(events.rows.map((row) => row.id)).toEqual([
      EVENT_ID,
      EVENT_OTHER,
    ]);

    // Ancienne session cookie : inutilisable en base (authz serveur
    // `disableCookieCache: true` — le cookieCache compact peut encore
    // décoder un payload client jusqu’à 5 min, risque UX résiduel).
    const sessionAfter = await auth.api.getSession({
      headers: new Headers({ cookie }),
      query: { disableCookieCache: true },
    });
    expect(sessionAfter).toBeNull();

    const staleSessionRow = await db.query(
      `SELECT count(*)::int AS n FROM "session" WHERE token = $1`,
      ["stale-session-token-other-device"],
    );
    expect(staleSessionRow.rows[0]).toEqual({ n: 0 });

    // Jeton non réutilisable (consumeVerificationValue + user/session absents).
    const reuse = await auth.handler(
      new Request(deleteVerification.url, {
        method: "GET",
        headers: {
          origin: AUTH_BASE_URL,
          cookie,
        },
      }),
    );
    expect(reuse.ok).toBe(false);
    expect([200, 302, 303, 307, 308]).not.toContain(reuse.status);
  });
});
