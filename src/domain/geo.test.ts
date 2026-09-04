import { describe, expect, it } from "vitest";
import { distanceKmBetween, type GeoPoint } from "@/domain/geo";

const ORLEANS: GeoPoint = { latitude: 47.9025, longitude: 1.909 };
const OLIVET: GeoPoint = { latitude: 47.863, longitude: 1.9 };
const PARIS: GeoPoint = { latitude: 48.8566, longitude: 2.3522 };

describe("distanceKmBetween", () => {
  it("retourne 0 pour le même point", () => {
    expect(distanceKmBetween(ORLEANS, ORLEANS)).toBe(0);
  });

  it("calcule une distance plausible Orléans → Olivet", () => {
    const distance = distanceKmBetween(ORLEANS, OLIVET);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(8);
  });

  it("calcule une distance plausible Orléans → Paris", () => {
    const distance = distanceKmBetween(ORLEANS, PARIS);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(140);
  });

  it("est symétrique", () => {
    const ab = distanceKmBetween(ORLEANS, PARIS);
    const ba = distanceKmBetween(PARIS, ORLEANS);
    expect(ab).toBeCloseTo(ba, 10);
  });
});
