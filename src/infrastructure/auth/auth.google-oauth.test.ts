import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely";
import { createAuth } from "@/infrastructure/auth/create-auth";

describe("auth Google OAuth config", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
  });

  afterAll(async () => {
    await db.close();
  });

  it("active Google + disableImplicitLinking sans exposer le secret dans options lisibles côté tests", async () => {
    const auth = createAuth({
      database: {
        dialect: new PGliteDialect({ pglite: db }),
        type: "postgres",
      },
      secret: "test-secret-at-least-32-characters-long!!",
      baseURL: "http://localhost:3002",
      socialProviders: {
        google: {
          clientId: "test-google-client-id.apps.googleusercontent.com",
          clientSecret: "test-google-client-secret-value",
        },
      },
    });
    const ctx = await auth.$context;
    const google = ctx.socialProviders.find((provider) => provider.id === "google");
    expect(google).toBeDefined();
    expect(auth.options.account?.accountLinking).toEqual({
      enabled: true,
      disableImplicitLinking: true,
    });
    expect(auth.options.emailAndPassword?.enabled).toBe(true);

    // Secret serveur uniquement — jamais exposé via NEXT_PUBLIC_*.
    const publicEnvKeys = Object.keys(process.env).filter((key) =>
      key.startsWith("NEXT_PUBLIC_GOOGLE"),
    );
    expect(publicEnvKeys).toEqual([]);
  });

  it("peut désactiver Google via override vide (tests / env absente)", async () => {
    const auth = createAuth({
      database: {
        dialect: new PGliteDialect({ pglite: db }),
        type: "postgres",
      },
      secret: "test-secret-at-least-32-characters-long!!",
      baseURL: "http://localhost:3002",
      socialProviders: {},
    });
    const ctx = await auth.$context;
    expect(
      ctx.socialProviders.find((provider) => provider.id === "google"),
    ).toBeUndefined();
  });
});
