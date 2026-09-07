import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { V1_COMMUNES } from "@/domain/geo/v1-communes";

describe("Explorer UI wiring", () => {
  it("ExplorationFilters n’expose plus le rayon", () => {
    const source = readFileSync(
      path.join(__dirname, "ExplorationFilters.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/radius|Rayon|RadiusFilter|km/);
    expect(source).toContain("V1_COMMUNES");
    expect(source).toContain("Toutes les villes");
  });

  it("HomePage délègue Explorer et n’importe plus le filtre client radius", () => {
    const source = readFileSync(path.join(__dirname, "HomePage.tsx"), "utf8");
    expect(source).toContain("ExplorerSection");
    expect(source).not.toMatch(/RadiusFilter|withinRadius|visibleCount/);
    expect(source).toContain("debugEvents");
  });

  it("page serveur charge Explorer via listExplorerEvents, pas result.events pour la grille", () => {
    const source = readFileSync(
      path.join(__dirname, "../app/page.tsx"),
      "utf8",
    );
    expect(source).toContain("listExplorerEvents");
    expect(source).toContain('when: "weekend"');
    expect(source).toContain("explorer={{");
    expect(source).toContain("debugEvents");
    expect(source).not.toMatch(/events=\{result\.events/);
  });

  it("référentiel villes UI = V1_COMMUNES", () => {
    expect(V1_COMMUNES[0]).toBe("Orléans");
    expect(V1_COMMUNES).toContain("Saran");
  });
});
