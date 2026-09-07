import { describe, expect, it } from "vitest";
import {
  CITY_CENTER_FALLBACKS,
  ORLEANS_CENTER,
  distanceKmBetween,
  resolveEventCoordinates,
  type GeoPoint,
} from "@/domain/geo/geo";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { DetourEvent } from "@/domain/events/event";

const ORLEANS: GeoPoint = { latitude: 47.9025, longitude: 1.909 };
const OLIVET: GeoPoint = { latitude: 47.863, longitude: 1.9 };
const PARIS: GeoPoint = { latitude: 48.8566, longitude: 2.3522 };

function baseEvent(
  overrides: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    startAt: "2026-09-12T20:00:00+02:00",
    endAt: null,
    venue: null,
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    ...overrides,
  };
}

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

describe("resolveEventCoordinates", () => {
  it("préfère les coords événement au fallback commune", () => {
    const point = resolveEventCoordinates({
      latitude: 47.86,
      longitude: 1.9,
      city: "Saran",
    });
    expect(point).toEqual({ latitude: 47.86, longitude: 1.9 });
  });

  it("Saran sans coords → centre commune", () => {
    const point = resolveEventCoordinates({
      latitude: null,
      longitude: null,
      city: "Saran",
    });
    expect(point).toEqual(CITY_CENTER_FALLBACKS.saran);
  });

  it("Ingré sans coords → centre commune (fallback distance)", () => {
    const point = resolveEventCoordinates({
      latitude: null,
      longitude: null,
      city: "Ingré",
    });
    expect(point).toEqual(CITY_CENTER_FALLBACKS.ingre);
  });

  it("ville inconnue sans coords → null", () => {
    expect(
      resolveEventCoordinates({
        latitude: null,
        longitude: null,
        city: "Inconnue-sur-Loire",
      }),
    ).toBeNull();
  });
});

describe("mapDetourEventToEventItem distance", () => {
  it("événement Saran sans coords → distance via fallback commune", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "saran:1",
        title: "Concert",
        city: "Saran",
        latitude: null,
        longitude: null,
      }),
    );
    const expected = distanceKmBetween(
      ORLEANS_CENTER,
      CITY_CENTER_FALLBACKS.saran,
    );
    expect(item.distanceKm).toBeCloseTo(expected, 5);
    expect(item.distanceKm).toBeGreaterThan(0);
  });

  it("événement avec coords réelles → ignore le fallback", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "saran:2",
        title: "Concert",
        city: "Saran",
        latitude: OLIVET.latitude,
        longitude: OLIVET.longitude,
      }),
    );
    const expected = distanceKmBetween(ORLEANS_CENTER, OLIVET);
    expect(item.distanceKm).toBeCloseTo(expected, 5);
    expect(item.distanceKm).not.toBeCloseTo(
      distanceKmBetween(ORLEANS_CENTER, CITY_CENTER_FALLBACKS.saran),
      1,
    );
  });

  it("ville inconnue sans coords → distance undefined", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "x",
        title: "Concert",
        city: "Nulle Part",
        latitude: null,
        longitude: null,
      }),
    );
    expect(item.distanceKm).toBeUndefined();
  });
});
