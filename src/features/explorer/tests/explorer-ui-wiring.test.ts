import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { V1_COMMUNES } from "@/domain/geo/v1-communes";

const explorerComponents = path.join(__dirname, "../components");
const homeComponents = path.join(__dirname, "../../home/components");
const loadExplorerPagePath = path.join(
  __dirname,
  "../../../app/_server/load-explorer-page.ts",
);
const loadHomePagePath = path.join(
  __dirname,
  "../../../app/_server/load-home-page.ts",
);
const publicExplorerPath = path.join(
  __dirname,
  "../../../application/explorer/get-public-explorer-initial-page.ts",
);
const publicHomePath = path.join(
  __dirname,
  "../../../application/home/get-public-home-data.ts",
);

describe("Explorer UI wiring", () => {
  it("ExplorationFilters n’expose plus le rayon", () => {
    const source = readFileSync(
      path.join(explorerComponents, "ExplorationFilters.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/radius|Rayon|RadiusFilter|km/);
    expect(source).toContain("V1_COMMUNES");
    expect(source).toContain("Toutes les villes");
  });

  it("HomePage délègue vers /explorer et n’embarque plus ExplorerSection", () => {
    const source = readFileSync(path.join(homeComponents, "HomePage.tsx"), "utf8");
    expect(source).toContain("HomeExplorerCta");
    expect(source).not.toContain("ExplorerSection");
    expect(source).not.toMatch(/RadiusFilter|withinRadius|visibleCount/);
    expect(source).toContain("debugEvents");
  });

  it("page Explorer charge via use case dédié, pas le pipeline Home", () => {
    const publicExplorer = readFileSync(publicExplorerPath, "utf8");
    const publicHome = readFileSync(publicHomePath, "utf8");
    const explorerLoader = readFileSync(loadExplorerPagePath, "utf8");
    const homeLoader = readFileSync(loadHomePagePath, "utf8");

    expect(publicExplorer).toContain("listExplorerEvents");
    expect(publicExplorer).toContain('when: PUBLIC_EXPLORER_INITIAL_WHEN');
    expect(publicExplorer).toContain("PUBLIC_EXPLORER_INITIAL_LIMIT");
    expect(publicExplorer).not.toContain("buildUpcomingPipeline");
    expect(publicExplorer).not.toContain("finalizeUpcomingWithAutoAi");

    expect(publicHome).not.toContain("listExplorerEvents");
    expect(homeLoader).not.toContain("explorer");
    expect(explorerLoader).toContain("getCachedPublicExplorerInitialPage");
  });

  it("référentiel villes UI = V1_COMMUNES", () => {
    expect(V1_COMMUNES[0]).toBe("Orléans");
    expect(V1_COMMUNES).toContain("Saran");
  });
});
