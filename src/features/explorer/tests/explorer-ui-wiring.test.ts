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

  it("ExplorerFilterBar : recherche + trois déclencheurs Quand / Où / Quoi", () => {
    const bar = readFileSync(
      path.join(explorerComponents, "ExplorerFilterBar.tsx"),
      "utf8",
    );
    const section = readFileSync(
      path.join(explorerComponents, "ExplorerSection.tsx"),
      "utf8",
    );
    expect(section).toContain("ExplorerFilterBar");
    expect(bar).toContain("Quand ?");
    expect(bar).toContain("Où ?");
    expect(bar).toContain("Quoi ?");
    expect(bar).toContain("ExplorerWhenPanel");
    expect(bar).toContain("useStackedDialogLifecycle");
    expect(bar).toContain("DesktopFilterPopover");
    expect(bar).toContain("createPortal");
    expect(bar).toContain("Search");
    expect(bar).toContain("Calendar");
    expect(bar).toContain("MapPin");
    expect(bar).toContain("Ticket");
    expect(bar).toContain("bg-mint/15");
    expect(bar).toContain("border-sauge");
    expect(bar).not.toMatch(/rounded-full/);
  });

  it("EventGrid : zone filtres unie + zone résultats texturée, sans mini-Hero", () => {
    const grid = readFileSync(
      path.join(explorerComponents, "EventGrid.tsx"),
      "utf8",
    );
    expect(grid).toContain("Parcourir");
    expect(grid).toContain("font-display");
    expect(grid).toContain("toolbar");
    expect(grid).toContain("resultTitle");
    expect(grid).toContain("detour-decor--explorer");
    expect(grid).toContain('aria-label="Filtres d’exploration"');
    expect(grid).toContain("max-w-[760px]");
    // Filtres hors texture ; résultats gardent detour-decor.
    expect(grid).toMatch(
      /Filtres d[\u2019']exploration[\s\S]*bg-paper[\s\S]*detour-decor--explorer/,
    );
    expect(grid).not.toContain("ExplorerSearchBand");
    expect(grid).not.toContain("detour-explorer-bandeau");
    expect(grid).not.toContain("new-detour-hero");
    expect(grid).not.toContain("-mt-4 border border-line bg-foam p-3 shadow");
  });

  it("HomePage délègue vers /explorer via le Radar, sans ExplorerSection", () => {
    const homePage = readFileSync(path.join(homeComponents, "HomePage.tsx"), "utf8");
    const detour = readFileSync(
      path.join(homeComponents, "radar/DetourSection.tsx"),
      "utf8",
    );
    expect(homePage).not.toContain("HomeExplorerCta");
    expect(homePage).not.toContain("ExplorerSection");
    expect(homePage).not.toMatch(/RadiusFilter|withinRadius|visibleCount/);
    expect(homePage).toContain("debugEvents");
    expect(detour).toContain('href="/explorer"');
    expect(detour).toContain("Explorer toutes les sorties");
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

  it("ExplorerSection branche les libellés période (titre + empty)", () => {
    const source = readFileSync(
      path.join(explorerComponents, "ExplorerSection.tsx"),
      "utf8",
    );
    expect(source).toContain("explorerPeriodResultTitle");
    expect(source).toContain("explorerPeriodEmptyMessage");
    expect(source).not.toContain("Retrouver tous les événements à venir");
    expect(source).not.toContain("GRID_RESULT_TITLES");
  });
});
