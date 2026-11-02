import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  it("bloque les routes techniques, pas account/frise (noindex metadata)", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/__"],
    });
    expect(rules?.disallow).not.toContain("/account/");
    expect(rules?.disallow).not.toContain("/frise");
    expect(result.sitemap).toBe("https://detour.website/sitemap.xml");
    expect(result.host).toBe("detour.website");
  });
});
