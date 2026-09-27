import { describe, expect, it } from "vitest";
import {
  FRISE_TRACK_HEIGHT_BOUNDS_PX,
  FRISE_TRACK_HEIGHT_CLASS,
  FRISE_TRACK_PB_CLASS,
} from "@/features/frise/frise-layout";

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

  it("garde les classes viewport (pas de hauteur fixe 26/32rem)", () => {
    expect(FRISE_TRACK_HEIGHT_CLASS).toContain("dvh");
    expect(FRISE_TRACK_HEIGHT_CLASS).toContain("clamp");
    expect(FRISE_TRACK_HEIGHT_CLASS).not.toContain("26rem");
    expect(FRISE_TRACK_HEIGHT_CLASS).not.toContain("32rem");
    expect(FRISE_TRACK_PB_CLASS).toContain("pb-");
  });
});
