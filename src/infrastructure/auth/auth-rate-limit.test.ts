/**
 * Rate limiting Better Auth 1.7.4 — stockage PostgreSQL partagé.
 * Cas principaux : PGlite (budget partagé, 429, redémarrage, expiration,
 * IP distinctes, panne stockage). Le cas `Promise.all` PGlite n’est pas une
 * preuve de concurrence PostgreSQL native.
 * Concurrence atomique : si `DATABASE_URL` est défini, test sur Postgres
 * (URL Neon directe dérivée, schéma jetable). Skip sans DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely";
import pg from "pg";
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
CREATE INDEX "rateLimit_lastRequest_idx" ON "rateLimit" ("lastRequest");
`;

type AuthInstance = ReturnType<typeof createAuth>;

function makeAuth(database: NonNullable<Parameters<typeof createAuth>[0]["database"]>): AuthInstance {
  return createAuth({
    database,
    secret: AUTH_SECRET,
    baseURL: AUTH_BASE_URL,
    plugins: [],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async () => undefined,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
    },
  });
}

async function postSignIn(auth: AuthInstance, ip: string): Promise<Response> {
  return auth.handler(
    new Request(`${AUTH_BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-forwarded-for": ip,
      },
      body: JSON.stringify({ email: "rate-limit@example.com", password: "password1" }),
    }),
  );
}

describe("Better Auth rateLimit storage database (PGlite)", () => {
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

  it("partage le budget entre deux instances et répond 429 + X-Retry-After", async () => {
    await db.exec(`DELETE FROM "rateLimit"`);
    const authA = makeAuth(dialect);
    const authB = makeAuth(dialect);
    const ip = "203.0.113.10";

    const allowed = [
      await postSignIn(authA, ip),
      await postSignIn(authB, ip),
      await postSignIn(authA, ip),
    ];
    for (const res of allowed) {
      expect(res.status).not.toBe(429);
    }

    const blocked = await postSignIn(authB, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("X-Retry-After")).toMatch(/^\d+$/);

    const { rows } = await db.query<{ count: number }>(
      `SELECT count FROM "rateLimit" WHERE key LIKE $1`,
      [`${ip}|%`],
    );
    expect(rows[0]?.count).toBe(3);
  });

  it("ne restaure pas le budget après recreation d'instance", async () => {
    await db.exec(`DELETE FROM "rateLimit"`);
    const ip = "203.0.113.11";
    const first = makeAuth(dialect);
    await postSignIn(first, ip);
    await postSignIn(first, ip);
    await postSignIn(first, ip);
    expect((await postSignIn(first, ip)).status).toBe(429);

    const recreated = makeAuth(dialect);
    expect((await postSignIn(recreated, ip)).status).toBe(429);
  });

  it("autorise de nouvelles tentatives après expiration de la fenêtre", async () => {
    await db.exec(`DELETE FROM "rateLimit"`);
    const ip = "203.0.113.12";
    const auth = makeAuth(dialect);
    await postSignIn(auth, ip);
    await postSignIn(auth, ip);
    await postSignIn(auth, ip);
    expect((await postSignIn(auth, ip)).status).toBe(429);

    await db.query(
      `UPDATE "rateLimit" SET "lastRequest" = $1 WHERE key LIKE $2`,
      [Date.now() - 11_000, `${ip}|%`],
    );

    expect((await postSignIn(auth, ip)).status).not.toBe(429);
  });

  it("isole les budgets par IP", async () => {
    await db.exec(`DELETE FROM "rateLimit"`);
    const auth = makeAuth(dialect);
    const ipA = "203.0.113.20";
    const ipB = "203.0.113.21";

    await postSignIn(auth, ipA);
    await postSignIn(auth, ipA);
    await postSignIn(auth, ipA);
    expect((await postSignIn(auth, ipA)).status).toBe(429);
    expect((await postSignIn(auth, ipB)).status).not.toBe(429);
  });

  it("ne bascule pas silencieusement vers la mémoire si le stockage tombe", async () => {
    const isolated = new PGlite();
    await isolated.exec(AUTH_TABLES_SQL);
    const isolatedDialect = {
      dialect: new PGliteDialect({ pglite: isolated }),
      type: "postgres" as const,
    };
    const auth = makeAuth(isolatedDialect);
    await postSignIn(auth, "198.51.100.1");

    await isolated.exec(`DROP TABLE "rateLimit"`);

    await expect(postSignIn(auth, "198.51.100.2")).rejects.toThrow(/rateLimit/i);
    await isolated.close();
  });

  it("sous Promise.all PGlite, le compteur ne dépasse pas max (pas une preuve PG native)", async () => {
    await db.exec(`DELETE FROM "rateLimit"`);
    const auth = makeAuth(dialect);
    const ip = "203.0.113.30";

    const responses = await Promise.all(
      Array.from({ length: 12 }, () => postSignIn(auth, ip)),
    );
    const allowed = responses.filter((r) => r.status !== 429);
    const blocked = responses.filter((r) => r.status === 429);

    expect(allowed.length).toBeLessThanOrEqual(3);
    expect(blocked.length).toBeGreaterThanOrEqual(9);

    const { rows } = await db.query<{ count: number }>(
      `SELECT count FROM "rateLimit" WHERE key LIKE $1`,
      [`${ip}|%`],
    );
    expect(rows[0]?.count).toBeLessThanOrEqual(3);
  });
});

/** Neon pooler (PgBouncer) ignore le search_path de session : URL directe. */
function neonDirectUrl(databaseUrl: string): string {
  return databaseUrl.replace("-pooler.", ".");
}

describe.runIf(Boolean(process.env.DATABASE_URL?.trim()))(
  "Better Auth rateLimit concurrence PostgreSQL (DATABASE_URL)",
  () => {
    const schema = `rl_s2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const directUrl = neonDirectUrl(process.env.DATABASE_URL!);
    let adminPool: pg.Pool;

    beforeAll(async () => {
      adminPool = new pg.Pool({
        connectionString: directUrl,
        options: `-c search_path=${schema}`,
      });
      await adminPool.query(`CREATE SCHEMA ${schema}`);
      await adminPool.query(AUTH_TABLES_SQL);
    });

    afterAll(async () => {
      const cleanup = new pg.Pool({ connectionString: directUrl });
      try {
        await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await cleanup.end();
        await adminPool.end();
      }
    });

    it("n'autorise pas plus de max requêtes concurrentes pour la même clé", async () => {
      const scopedPool = new pg.Pool({
        connectionString: directUrl,
        max: 8,
        options: `-c search_path=${schema}`,
      });
      try {
        const authA = makeAuth(scopedPool);
        const authB = makeAuth(scopedPool);
        const ip = "203.0.113.40";

        const responses = await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            postSignIn(i % 2 === 0 ? authA : authB, ip),
          ),
        );
        const allowed = responses.filter((r) => r.status !== 429);
        const blocked = responses.filter((r) => r.status === 429);

        expect(allowed.length).toBe(3);
        expect(blocked.length).toBe(17);

        const { rows } = await scopedPool.query<{ count: number }>(
          `SELECT count FROM "rateLimit" WHERE key LIKE $1`,
          [`${ip}|%`],
        );
        expect(rows[0]?.count).toBe(3);
      } finally {
        await scopedPool.end();
      }
    });
  },
);
