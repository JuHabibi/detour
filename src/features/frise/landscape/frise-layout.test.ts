import { describe, expect, it } from "vitest";
import {
  FRISE_DAY_MARK_PT_CLASS,
  FRISE_TRACK_HEIGHT_BOUNDS_PX,
  FRISE_TRACK_HEIGHT_CLASS,
  FRISE_TRACK_PB_CLASS,
} from "@/features/frise/landscape/frise-layout";

describe("frise-layout proportions", () => {
  it("expose une hauteur desktop dans la cible 650–750 px", () => {
    expect(FRISE_TRACK_HEIGHT_BOUNDS_PX.desktopMin).toBeLessThanOrEqual(
      FRISE_TRACK_HEIGHT_BOUNDS_PX.desktopTargetMin,
    );
    expect(FRISE_TRACK_HEIGHT_BOUNDS_PX.desktopMax).toBeGreaterThanOrEqual(
      FRISE_TRACK_HEIGHT_BOUNDS_PX.desktopTargetMax,
    );
    expect(FRISE_TRACK_HEIGHT_BOUNDS_PX.desktopMin).toBe(608);
    expect(FRISE_TRACK_HEIGHT_BOUNDS_PX.desktopMax).toBe(750);
  });

  it("garde les classes viewport (clamp + dvh)", () => {
    expect(FRISE_TRACK_HEIGHT_CLASS).toContain("dvh");
    expect(FRISE_TRACK_HEIGHT_CLASS).toContain("clamp");
    expect(FRISE_TRACK_HEIGHT_CLASS).toContain("26rem");
    expect(FRISE_TRACK_HEIGHT_CLASS).toContain("32rem");
    expect(FRISE_TRACK_PB_CLASS).toContain("pb-");
  });

  it("réserve l’espace sous le chip pour la date du jour", () => {
    expect(FRISE_DAY_MARK_PT_CLASS).toContain("pt-[5.25rem]");
    expect(FRISE_DAY_MARK_PT_CLASS).toContain("md:pt-2");
  });

  it("mobile un peu plus haut pour carte + bouton au-dessus du vélo", () => {
    expect(FRISE_TRACK_HEIGHT_BOUNDS_PX.mobileMin).toBe(416);
    expect(FRISE_TRACK_HEIGHT_BOUNDS_PX.mobileMax).toBe(512);
  });
});
