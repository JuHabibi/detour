import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("getPublicHomeData — invariants public", () => {
  it("signature sans paramètre user / session / favoris", async () => {
    const mod = await import("@/application/home/get-public-home-data");
    expect(typeof mod.getPublicHomeData).toBe("function");
    expect(typeof mod.getPublicHomeSnapshot).toBe("function");
    expect(typeof mod.materializePublicHomeData).toBe("function");
    // Un seul objet params — pas de 2e arg user
    expect(mod.getPublicHomeData.length).toBe(1);
    expect(mod.getPublicHomeSnapshot.length).toBe(1);
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
    expect(source).toContain("buildUpcomingPipeline");
    expect(source).toContain("finalizeUpcomingWithAutoAi");
    expect(source).toContain("listExplorerEvents");
  });
});

describe("next-public-home-cache — frontière nest IA", () => {
  it("snapshot dans unstable_cache ; materialize (IA) hors callback", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/infrastructure/next-public-home-cache.ts"),
      "utf8",
    );
    expect(source).toContain("getPublicHomeSnapshot");
    expect(source).toContain("materializePublicHomeData");
    expect(source).not.toMatch(/return getPublicHomeData\(/);
    // materialize après await cachedSnapshot — pas dans le callback
    const callbackStart = source.indexOf("async () => {");
    const callbackBody = source.slice(
      callbackStart,
      source.indexOf("},", callbackStart),
    );
    expect(callbackBody).toContain("getPublicHomeSnapshot");
    expect(callbackBody).not.toContain("materializePublicHomeData");
    expect(callbackBody).not.toContain("finalizeUpcomingWithAutoAi");
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
