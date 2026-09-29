import { describe, expect, it } from "vitest";
import { friseDayCountLabel } from "@/features/frise/components/FriseRideTrack";

describe("friseDayCountLabel", () => {
  it("ne signale pas une journée avec un seul événement", () => {
    expect(friseDayCountLabel(1, "sorties")).toBeNull();
    expect(friseDayCountLabel(1, "favoris")).toBeNull();
    expect(friseDayCountLabel(1, "carnet")).toBeNull();
  });

  it("signale deux événements uniquement dans les vues personnelles", () => {
    expect(friseDayCountLabel(2, "sorties")).toBeNull();
    expect(friseDayCountLabel(2, "favoris")).toBe("2 événements");
    expect(friseDayCountLabel(2, "carnet")).toBe("2 événements");
  });

  it("conserve le libellé Découvrir à partir de trois événements", () => {
    expect(friseDayCountLabel(3, "sorties")).toBe("3 sorties");
    expect(friseDayCountLabel(3, "favoris")).toBe("3 événements");
    expect(friseDayCountLabel(3, "carnet")).toBe("3 événements");
  });
});
