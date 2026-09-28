import { describe, expect, it } from "vitest";
import {
  FRISE_PROMENADE_ARTBOARD,
  FRISE_PROMENADE_CYCLE,
  FRISE_PROMENADE_PANEL_ASSETS,
  FRISE_RIVE_OVERLAP_SOURCE_PX,
  planPromenadeCoverage,
  planPromenadeForegroundOffsets,
  planRiveContinuum,
  promenadePanelDisplayWidth,
  promenadePanelStepPx,
} from "@/features/frise/landscape/frise-promenade-spec";

describe("frise-promenade-spec — dimensions", () => {
  it("préserve le ratio artboard à l’affichage", () => {
    const band = 224; // ≈ 14rem
    const w = promenadePanelDisplayWidth(band);
    expect(w).toBeCloseTo(
      (FRISE_PROMENADE_ARTBOARD.widthPx / FRISE_PROMENADE_ARTBOARD.heightPx) *
        band,
      5,
    );
  });

  it("le pas est inférieur à la largeur (chevauchement)", () => {
    const band = 224;
    expect(promenadePanelStepPx(band)).toBeLessThan(
      promenadePanelDisplayWidth(band),
    );
  });
});

describe("planPromenadeCoverage — largeur variable", () => {
  const bandHeightPx = 224;

  it("frise courte : au moins un panneau, couverture ≥ track", () => {
    const plan = planPromenadeCoverage({
      trackWidthPx: 400,
      bandHeightPx,
    });
    expect(plan.panelCount).toBeGreaterThanOrEqual(1);
    expect(plan.coveredWidthPx).toBeGreaterThanOrEqual(400);
    expect(plan.panels[0]?.panelId).toBe("loire-a");
  });

  it("frise longue : plus de panneaux qu’une frise courte", () => {
    const short = planPromenadeCoverage({
      trackWidthPx: 800,
      bandHeightPx,
    });
    const long = planPromenadeCoverage({
      trackWidthPx: 4800,
      bandHeightPx,
    });
    expect(long.panelCount).toBeGreaterThan(short.panelCount);
    expect(long.coveredWidthPx).toBeGreaterThanOrEqual(4800);
  });

  it("alterne le cycle narratif A puis B", () => {
    const plan = planPromenadeCoverage({
      trackWidthPx: 5000,
      bandHeightPx,
    });
    const ids = plan.panels.map((p) => p.panelId);
    expect(ids.slice(0, 6)).toEqual([...FRISE_PROMENADE_CYCLE]);
    if (ids.length > 6) {
      expect(ids[6]).toBe("loire-a");
    }
  });

  it("track vide → aucun panneau", () => {
    const plan = planPromenadeCoverage({
      trackWidthPx: 0,
      bandHeightPx,
    });
    expect(plan.panelCount).toBe(0);
    expect(plan.panels).toEqual([]);
  });
});

describe("manifeste assets", () => {
  it("expose 6 panneaux + chemins stables", () => {
    expect(FRISE_PROMENADE_PANEL_ASSETS).toHaveLength(6);
    expect(FRISE_PROMENADE_PANEL_ASSETS.map((a) => a.src)).toEqual([
      "/images/frise/promenade-loire-a.webp",
      "/images/frise/promenade-ville-a.webp",
      "/images/frise/promenade-jardin-a.webp",
      "/images/frise/promenade-loire-b.webp",
      "/images/frise/promenade-ville-b.webp",
      "/images/frise/promenade-jardin-b.webp",
    ]);
  });
});

describe("planPromenadeForegroundOffsets", () => {
  it("espace les accents et plafonne", () => {
    const offsets = planPromenadeForegroundOffsets(3000, {
      minGapPx: 500,
      maxPerTrack: 4,
    });
    expect(offsets.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]! - offsets[i - 1]!).toBeGreaterThanOrEqual(500);
    }
  });
});

describe("planRiveContinuum", () => {
  const bandHeightPx = 512;

  it("chevauchements desktop ≈ 102 / 92 / 71 px à H=512", () => {
    const plan = planRiveContinuum({ trackWidthPx: 9000, bandHeightPx });
    expect(plan.overlapsPx.loireQuay).toBeCloseTo(
      FRISE_RIVE_OVERLAP_SOURCE_PX.loireOverQuay * (512 / 1006),
      0,
    );
    expect(plan.overlapsPx.quayEntree).toBeCloseTo(
      FRISE_RIVE_OVERLAP_SOURCE_PX.quayOverEntree * (512 / 1006),
      0,
    );
    expect(plan.overlapsPx.entreeMotif).toBeCloseTo(
      FRISE_RIVE_OVERLAP_SOURCE_PX.entreeOverMotif * (512 / 1006),
      0,
    );
  });

  it("couvre le track avec des motifs bord à bord", () => {
    const plan = planRiveContinuum({ trackWidthPx: 9200, bandHeightPx });
    expect(plan.motifCount).toBeGreaterThan(0);
    expect(plan.coveredWidthPx).toBeGreaterThanOrEqual(9200);
    const motifs = plan.scenes.filter((s) => s.id === "rive-motif-bouclable");
    expect(motifs.length).toBe(plan.motifCount);
    for (let i = 1; i < motifs.length; i += 1) {
      expect(motifs[i]!.leftPx).toBeCloseTo(
        motifs[i - 1]!.leftPx + motifs[i - 1]!.widthPx,
        5,
      );
    }
  });

  it("empile Loire devant quai devant entrée devant motif", () => {
    const plan = planRiveContinuum({ trackWidthPx: 5000, bandHeightPx });
    const z = Object.fromEntries(
      [...new Map(plan.scenes.map((s) => [s.id, s.zIndex])).entries()],
    );
    expect(z["loire-a"]).toBeGreaterThan(z["quai-pop-a-vers-rive"]!);
    expect(z["quai-pop-a-vers-rive"]).toBeGreaterThan(z["quai-rive-entree"]!);
    expect(z["quai-rive-entree"]).toBeGreaterThan(z["rive-motif-bouclable"]!);
  });
});
