import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("auth cookieCache config", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/infrastructure/auth/auth.ts"),
    "utf8",
  );

  it("active session.cookieCache compact 5 min, sans refreshCache", () => {
    expect(source).toMatch(/session:\s*\{/);
    expect(source).toMatch(/cookieCache:\s*\{/);
    expect(source).toMatch(/enabled:\s*true/);
    expect(source).toMatch(/maxAge:\s*5\s*\*\s*60/);
    expect(source).toMatch(/strategy:\s*"compact"/);
    expect(source).not.toMatch(/refreshCache/);
    expect(source).not.toMatch(/disableSessionRefresh/);
    expect(source).not.toMatch(/updateAge/);
  });

  it("conserve nextCookies et email/password, sans plugin JWT", () => {
    expect(source).toContain("nextCookies()");
    expect(source).toContain("emailAndPassword");
    expect(source).not.toMatch(/from ["']better-auth\/plugins\/jwt["']/);
    expect(source).not.toMatch(/\bjwt\(/);
  });
});
