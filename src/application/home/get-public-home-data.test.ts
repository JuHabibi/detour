import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("getPublicHomeData — invariants public", () => {
  it("signature sans paramètre user / session / favoris", async () => {
    const mod = await import("@/application/home/get-public-home-data");
    expect(typeof mod.getPublicHomeData).toBe("function");
    // Un seul objet params — pas de 2e arg user
    expect(mod.getPublicHomeData.length).toBe(1);
  });

  it("source : pas d’auth ni de favoris dans le compute public", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/application/home/get-public-home-data.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/getAccountAuthState/);
    expect(source).not.toMatch(/listFavoriteEventIdsForUser/);
    expect(source).not.toMatch(/favorite/);
    expect(source).toContain("getUpcomingEvents");
    expect(source).toContain("listExplorerEvents");
  });
});

describe("loadHomePage — frontière public / user", () => {
  it("orchestre cache public + auth + favoris hors cache", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/_server/load-home-page.ts"),
      "utf8",
    );
    expect(source).toContain("getCachedPublicHomeData");
    expect(source).toContain("getAccountAuthState");
    expect(source).toContain("listFavoriteEventIdsForUser");
    expect(source).not.toContain("getUpcomingEvents");
    expect(source).not.toContain("listExplorerEvents");
  });
});
