import { describe, expect, it } from "vitest";
import { absoluteSiteUrl, PUBLIC_SITE_ORIGIN } from "@/config/site";

describe("PUBLIC_SITE_ORIGIN", () => {
  it("pointe vers le domaine public de production documenté", () => {
    expect(PUBLIC_SITE_ORIGIN).toBe("https://detour.website");
  });
});

describe("absoluteSiteUrl", () => {
  it("normalise la racine sans slash final (aligné canonical Next)", () => {
    expect(absoluteSiteUrl()).toBe("https://detour.website");
    expect(absoluteSiteUrl("/")).toBe("https://detour.website");
  });

  it("compose les chemins publics sans slash final superflu", () => {
    expect(absoluteSiteUrl("/explorer")).toBe(
      "https://detour.website/explorer",
    );
    expect(absoluteSiteUrl("explorer")).toBe("https://detour.website/explorer");
    expect(absoluteSiteUrl("/explorer/")).toBe(
      "https://detour.website/explorer",
    );
  });
});
