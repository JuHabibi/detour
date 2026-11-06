import { describe, expect, it } from "vitest";
import {
  publicRobotsHost,
  publicRobotsSitemapUrl,
  publicSitemapEntries,
  PUBLIC_SITEMAP_PATHS,
} from "@/config/seo";

describe("sitemap / robots publics", () => {
  it("expose Home, Explorer, Ce week-end, Confidentialité et Mentions", () => {
    expect([...PUBLIC_SITEMAP_PATHS]).toEqual([
      "/",
      "/explorer",
      "/orleans/ce-week-end",
      "/confidentialite",
    ]);
    expect(publicSitemapEntries()).toEqual([
      { url: "https://detour.website" },
      { url: "https://detour.website/explorer" },
      { url: "https://detour.website/orleans/ce-week-end" },
      { url: "https://detour.website/confidentialite" },
      { url: "https://detour.website/mentions-legales" },
    ]);
  });

  it("pointe robots vers le sitemap et le host canoniques", () => {
    expect(publicRobotsSitemapUrl()).toBe(
      "https://detour.website/sitemap.xml",
    );
    expect(publicRobotsHost()).toBe("detour.website");
  });
});
