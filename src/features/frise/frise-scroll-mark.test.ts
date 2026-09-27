import { describe, expect, it } from "vitest";
import {
  friseScrollProgress,
  resolveActiveFriseMark,
  type FriseScrollMark,
} from "@/features/frise/frise-scroll-mark";

function mark(
  partial: Pick<FriseScrollMark, "offsetLeft" | "monthKey" | "monthLabel"> &
    Partial<FriseScrollMark>,
): FriseScrollMark {
  return {
    offsetWidth: 160,
    ...partial,
  };
}

describe("resolveActiveFriseMark", () => {
  const marks: FriseScrollMark[] = [
    mark({
      offsetLeft: 0,
      monthKey: "2026-09",
      monthLabel: "Septembre 2026",
      detailLabel: "Septembre 2026",
    }),
    mark({
      offsetLeft: 400,
      monthKey: "2026-09",
      monthLabel: "Septembre 2026",
      detailLabel: "Ven. 12 sept.",
    }),
    mark({
      offsetLeft: 900,
      monthKey: "2026-10",
      monthLabel: "Octobre 2026",
      detailLabel: "Octobre 2026",
    }),
    mark({
      offsetLeft: 1200,
      monthKey: "2026-10",
      monthLabel: "Octobre 2026",
      detailLabel: "Jeu. 1 oct.",
    }),
    mark({
      offsetLeft: 1800,
      monthKey: "2026-11",
      monthLabel: "Novembre 2026",
      detailLabel: "Novembre 2026",
    }),
  ];

  it("retourne null sans marqueurs", () => {
    expect(resolveActiveFriseMark([], 0, 800)).toBeNull();
  });

  it("associe le début du scroll au premier mois", () => {
    const active = resolveActiveFriseMark(marks, 0, 800);
    expect(active?.monthKey).toBe("2026-09");
    expect(active?.monthLabel).toBe("Septembre 2026");
  });

  it("passe à octobre quand le focus atteint ce chapitre", () => {
    // focus à scrollLeft + 0.35 * 800
    const active = resolveActiveFriseMark(marks, 800, 800);
    expect(active?.monthKey).toBe("2026-10");
  });

  it("gère un jour à cheval près de la frontière de mois", () => {
    // Focus proche du jour 1er oct. (offset 1200)
    const active = resolveActiveFriseMark(marks, 1000, 800);
    expect(active?.monthKey).toBe("2026-10");
    expect(active?.detailLabel).toMatch(/oct/i);
  });

  it("reste sur novembre en fin de frise", () => {
    const active = resolveActiveFriseMark(marks, 1700, 800);
    expect(active?.monthKey).toBe("2026-11");
  });
});

describe("friseScrollProgress", () => {
  it("borne entre 0 et 1", () => {
    expect(friseScrollProgress(0, 2000, 800)).toBe(0);
    expect(friseScrollProgress(1200, 2000, 800)).toBe(1);
    expect(friseScrollProgress(600, 2000, 800)).toBeCloseTo(0.5);
  });
});
