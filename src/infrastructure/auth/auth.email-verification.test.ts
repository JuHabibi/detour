import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely";
import { createAuth } from "@/infrastructure/auth/create-auth";

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
      secret: "test-secret-at-least-32-characters-long!!",
      baseURL: "http://localhost:3002",
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
    // Ne pas forcer sendOnSignUp: true (éviterait un mail sur signup Google).
    expect(auth.options.emailVerification?.sendOnSignUp).toBeUndefined();
  });

  it("defaults createAuth : requireEmailVerification + sendOnSignIn", async () => {
    const auth = createAuth({
      database: {
        dialect: new PGliteDialect({ pglite: db }),
        type: "postgres",
      },
      secret: "test-secret-at-least-32-characters-long!!",
      baseURL: "http://localhost:3002",
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
});
