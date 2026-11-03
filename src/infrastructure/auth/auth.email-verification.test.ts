import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely";
import { createAuth } from "@/infrastructure/auth/create-auth";

const AUTH_BASE_URL = "http://localhost:3002";
const AUTH_SECRET = "test-secret-at-least-32-characters-long!!";

const AUTH_TABLES_SQL = `
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
`;

describe("auth email verification config", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
  });

  afterAll(async () => {
    await db.close();
  });

  it("exige la vérif email credential sans auto-login post-vérif", async () => {
    const auth = createAuth({
      database: {
        dialect: new PGliteDialect({ pglite: db }),
        type: "postgres",
      },
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: true,
        sendResetPassword: async () => undefined,
      },
      emailVerification: {
        sendVerificationEmail: async () => undefined,
        sendOnSignIn: true,
        autoSignInAfterVerification: false,
        expiresIn: 3600,
      },
    });

    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
    expect(auth.options.emailVerification?.sendOnSignIn).toBe(true);
    expect(auth.options.emailVerification?.autoSignInAfterVerification).toBe(
      false,
    );
    expect(auth.options.emailVerification?.expiresIn).toBe(3600);
    expect(auth.options.emailVerification?.sendOnSignUp).toBeUndefined();
  });

  it("defaults createAuth : requireEmailVerification + sendOnSignIn", async () => {
    const auth = createAuth({
      database: {
        dialect: new PGliteDialect({ pglite: db }),
        type: "postgres",
      },
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
    });

    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
    expect(auth.options.emailVerification?.sendOnSignIn).toBe(true);
    expect(auth.options.emailVerification?.autoSignInAfterVerification).toBe(
      false,
    );
    expect(auth.options.emailVerification?.sendVerificationEmail).toEqual(
      expect.any(Function),
    );
  });

  it("propage l’échec de révocation post-vérif (pas d’avalement silencieux)", async () => {
    const auth = createAuth({
      database: {
        dialect: new PGliteDialect({ pglite: db }),
        type: "postgres",
      },
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
      revokeUserSessionsAfterEmailVerification: async () => {
        throw new Error("revoke failed");
      },
    });

    const after = auth.options.emailVerification?.afterEmailVerification;
    expect(after).toEqual(expect.any(Function));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      after?.(
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "a@b.fr",
          emailVerified: true,
          name: "A",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        undefined,
      ),
    ).rejects.toThrow(/revoke failed/);
    expect(JSON.stringify(errorSpy.mock.calls)).toContain(
      "SESSION_REVOKE_FAILED",
    );
    errorSpy.mockRestore();
  });
});

describe("auth email verification flows (PGlite)", () => {
  let db: PGlite;
  let dialect: { dialect: PGliteDialect; type: "postgres" };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(AUTH_TABLES_SQL);
    dialect = { dialect: new PGliteDialect({ pglite: db }), type: "postgres" };
  });

  afterAll(async () => {
    await db.close();
  });

  it("compte créé malgré échec d’envoi : renvoi possible sans recréation", async () => {
    let sendCount = 0;
    const auth = createAuth({
      database: dialect,
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
      plugins: [],
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: true,
        sendResetPassword: async () => undefined,
      },
      emailVerification: {
        sendVerificationEmail: async () => {
          sendCount += 1;
          if (sendCount === 1) {
            throw new Error("Resend down");
          }
        },
        sendOnSignIn: true,
        autoSignInAfterVerification: false,
        expiresIn: 3600,
      },
      rateLimit: { enabled: false },
    });

    const signUp = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          name: "Camille",
          email: "camille-verify@exemple.fr",
          password: "password1",
          callbackURL: "/account/verify-email?confirmed=1",
        }),
      }),
    );
    // BA avale l’erreur d’envoi : 200 + user créé, token null.
    expect(signUp.status).toBe(200);
    const signUpBody = (await signUp.json()) as {
      token: string | null;
      user?: { email?: string };
    };
    expect(signUpBody.token).toBeNull();
    expect(signUpBody.user?.email).toBe("camille-verify@exemple.fr");

    const users = await db.query<{ email: string; emailVerified: boolean }>(
      `SELECT email, "emailVerified" FROM "user" WHERE email = $1`,
      ["camille-verify@exemple.fr"],
    );
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]?.emailVerified).toBe(false);

    const resend = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/send-verification-email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          email: "camille-verify@exemple.fr",
          callbackURL: "/account/verify-email?confirmed=1",
        }),
      }),
    );
    expect(resend.status).toBe(200);
    expect(sendCount).toBe(2);

    const usersAfter = await db.query(
      `SELECT count(*)::int AS n FROM "user" WHERE email = $1`,
      ["camille-verify@exemple.fr"],
    );
    expect(usersAfter.rows[0]).toEqual({ n: 1 });
  });

  it("login historique non vérifié → EMAIL_NOT_VERIFIED (pas de session)", async () => {
    const sends: string[] = [];
    const auth = createAuth({
      database: dialect,
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
      plugins: [],
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: true,
        sendResetPassword: async () => undefined,
      },
      emailVerification: {
        sendVerificationEmail: async ({ user }) => {
          sends.push(user.email);
        },
        sendOnSignIn: true,
        autoSignInAfterVerification: false,
        expiresIn: 3600,
      },
      rateLimit: { enabled: false },
    });

    // Crée le user via signup (envoi OK).
    await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          name: "Historique",
          email: "historique@exemple.fr",
          password: "password1",
        }),
      }),
    );

    const signIn = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          email: "historique@exemple.fr",
          password: "password1",
          callbackURL: "/account/verify-email?confirmed=1",
        }),
      }),
    );
    expect(signIn.status).toBe(403);
    const body = (await signIn.json()) as { code?: string };
    expect(body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(sends).toContain("historique@exemple.fr");

    const sessions = await db.query(
      `SELECT count(*)::int AS n FROM "session" s
       JOIN "user" u ON u.id = s."userId"
       WHERE u.email = $1`,
      ["historique@exemple.fr"],
    );
    expect(sessions.rows[0]).toEqual({ n: 0 });
  });

  it("EMAIL_NOT_VERIFIED seulement après mot de passe valide (sinon INVALID_EMAIL_OR_PASSWORD)", async () => {
    const auth = createAuth({
      database: dialect,
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
      plugins: [],
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: true,
        sendResetPassword: async () => undefined,
      },
      emailVerification: {
        sendVerificationEmail: async () => undefined,
        sendOnSignIn: true,
        autoSignInAfterVerification: false,
        expiresIn: 3600,
      },
      rateLimit: { enabled: false },
    });

    await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          name: "Enum",
          email: "enum-check@exemple.fr",
          password: "password1",
        }),
      }),
    );

    const wrongPassword = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          email: "enum-check@exemple.fr",
          password: "wrong-password",
        }),
      }),
    );
    expect(wrongPassword.status).toBe(401);
    const wrongBody = (await wrongPassword.json()) as { code?: string };
    expect(wrongBody.code).toBe("INVALID_EMAIL_OR_PASSWORD");

    const unknown = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          email: "inconnu-enum@exemple.fr",
          password: "password1",
        }),
      }),
    );
    expect(unknown.status).toBe(401);
    const unknownBody = (await unknown.json()) as { code?: string };
    expect(unknownBody.code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("send-verification-email public : même succès pour inconnu et non vérifié", async () => {
    const sent: string[] = [];
    const auth = createAuth({
      database: dialect,
      secret: AUTH_SECRET,
      baseURL: AUTH_BASE_URL,
      socialProviders: {},
      plugins: [],
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: true,
        sendResetPassword: async () => undefined,
      },
      emailVerification: {
        sendVerificationEmail: async ({ user }) => {
          sent.push(user.email);
        },
        sendOnSignIn: false,
        autoSignInAfterVerification: false,
        expiresIn: 3600,
      },
      rateLimit: { enabled: false },
    });

    await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          name: "Resend",
          email: "resend-enum@exemple.fr",
          password: "password1",
        }),
      }),
    );

    const known = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/send-verification-email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          email: "resend-enum@exemple.fr",
          callbackURL: "/account/verify-email?confirmed=1",
        }),
      }),
    );
    const unknown = await auth.handler(
      new Request(`${AUTH_BASE_URL}/api/auth/send-verification-email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: AUTH_BASE_URL,
        },
        body: JSON.stringify({
          email: "pas-inscrit@exemple.fr",
          callbackURL: "/account/verify-email?confirmed=1",
        }),
      }),
    );

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual({ status: true });
    expect(await unknown.json()).toEqual({ status: true });
    // Signup + renvoi connu ; jamais d’envoi vers l’adresse inconnue.
    expect(sent.every((email) => email === "resend-enum@exemple.fr")).toBe(
      true,
    );
    expect(sent).not.toContain("pas-inscrit@exemple.fr");
  });
});
