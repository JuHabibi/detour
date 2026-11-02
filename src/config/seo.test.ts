import { describe, expect, it } from "vitest";
import {
  publicRobotsHost,
  publicRobotsSitemapUrl,
  publicSitemapEntries,
  PUBLIC_SITEMAP_PATHS,
} from "@/config/seo";

describe("sitemap / robots publics", () => {
  it("n’expose que Home et Explorer propre", () => {
    expect([...PUBLIC_SITEMAP_PATHS]).toEqual(["/", "/explorer"]);
    expect(publicSitemapEntries()).toEqual([
      { url: "https://detour.website" },
      { url: "https://detour.website/explorer" },
    ]);
  });

  it("pointe robots vers le sitemap et le host canoniques", () => {
    expect(publicRobotsSitemapUrl()).toBe(
      "https://detour.website/sitemap.xml",
    );
    expect(publicRobotsHost()).toBe("detour.website");
  });
});
