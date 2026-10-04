import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely";
import { createAuth } from "@/infrastructure/auth/create-auth";

describe("auth cookieCache config", () => {
  let db: PGlite;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    db = new PGlite();
    auth = createAuth({
      database: { dialect: new PGliteDialect({ pglite: db }), type: "postgres" },
      secret: "test-secret-at-least-32-characters-long!!",
      baseURL: "http://localhost:3002",
    });
    await auth.$context;
  });

  afterAll(async () => {
    await db.close();
  });

  it("active session.cookieCache compact 5 min, sans refreshCache", () => {
    expect(auth.options.session?.cookieCache).toEqual({
      enabled: true,
      maxAge: 300,
      strategy: "compact",
    });
    expect(auth.options.session).not.toHaveProperty("refreshCache");
    expect(auth.options.session).not.toHaveProperty("disableSessionRefresh");
    expect(auth.options.session).not.toHaveProperty("updateAge");
  });

  it("conserve nextCookies et email/password, sans plugin JWT", () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
    expect(pluginIds).toContain("next-cookies");
    expect(pluginIds).not.toContain("jwt");
  });
});
