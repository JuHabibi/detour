import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { V1_COMMUNES } from "@/domain/geo/v1-communes";

const homeComponents = path.join(__dirname, "../components");
const loadHomePagePath = path.join(
  __dirname,
  "../../../app/_server/load-home-page.ts",
);

describe("Explorer UI wiring", () => {
  it("ExplorationFilters n’expose plus le rayon", () => {
    const source = readFileSync(
      path.join(homeComponents, "ExplorationFilters.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/radius|Rayon|RadiusFilter|km/);
    expect(source).toContain("V1_COMMUNES");
    expect(source).toContain("Toutes les villes");
  });

  it("HomePage délègue Explorer et n’importe plus le filtre client radius", () => {
    const source = readFileSync(path.join(homeComponents, "HomePage.tsx"), "utf8");
    expect(source).toContain("ExplorerSection");
    expect(source).not.toMatch(/RadiusFilter|withinRadius|visibleCount/);
    expect(source).toContain("debugEvents");
  });

  it("page serveur charge Explorer via listExplorerEvents, pas result.events pour la grille", () => {
    const publicHomePath = path.join(
      __dirname,
      "../../../application/home/get-public-home-data.ts",
    );
    const publicSource = readFileSync(publicHomePath, "utf8");
    const loaderSource = readFileSync(loadHomePagePath, "utf8");
    expect(publicSource).toContain("listExplorerEvents");
    expect(publicSource).toContain('when: "weekend"');
    expect(loaderSource).toContain("getCachedPublicHomeData");
    expect(loaderSource).toContain("explorer:");
    expect(loaderSource).toContain("debugEvents");
    expect(loaderSource).not.toMatch(/events=\{result\.events/);
  });

  it("référentiel villes UI = V1_COMMUNES", () => {
    expect(V1_COMMUNES[0]).toBe("Orléans");
    expect(V1_COMMUNES).toContain("Saran");
  });
});
