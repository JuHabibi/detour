import { describe, expect, it } from "vitest";
import {
  mapDetourEventToEventItem,
  resolveCategoryBadgeLabel,
} from "@/application/map-detour-event-to-ui";
import type { DetourEvent } from "@/domain/event";
import {
  CITY_CENTER_FALLBACKS,
  ORLEANS_CENTER,
  distanceKmBetween,
} from "@/domain/geo";

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
    category: null,
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    ...overrides,
  };
}

describe("mapDetourEventToEventItem — catégorie UI", () => {
  it("out_of_scope n’override pas la taxonomy (Forum → Fête)", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "forum",
        title: "Forum des associations 2026",
        category: "Fête - salon - marché;Musique",
        description: "Animations musicales et stands",
        relevance: "out_of_scope",
      }),
    );
    expect(item.category).toBe("Fête / salon / marché");
    expect(item.relevance).toBe("out_of_scope");
  });

  it("culture → taxonomy normale", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "c1",
        title: "Concert jazz",
        relevance: "culture",
      }),
    );
    expect(item.category).toBe("Musique");
  });

  it("culture_leisure → taxonomy normale", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "l1",
        title: "Escape Game",
        relevance: "culture_leisure",
      }),
    );
    expect(item.category).toBe("Loisirs culturels");
  });

  it("uncertain → taxonomy normale (comportement inchangé)", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "u1",
        title: "Concert en plein air",
        relevance: "uncertain",
      }),
    );
    expect(item.category).toBe("Musique");
  });
});

describe("resolveCategoryBadgeLabel", () => {
  it("préfère sourceCategory même si category produit = Autre", () => {
    expect(
      resolveCategoryBadgeLabel({
        category: "Autre",
        genre: "",
        sourceCategory: "Sport",
      }),
    ).toBe("Sport");
  });

  it("formate les catégories source multiples", () => {
    expect(
      resolveCategoryBadgeLabel({
        category: "Autre",
        genre: "",
        sourceCategory: "Fête - salon - marché;Musique",
      }),
    ).toBe("Fête - salon - marché · Musique");
  });

  it("utilise genre si pas de sourceCategory", () => {
    expect(
      resolveCategoryBadgeLabel({
        category: "Autre",
        genre: "Jazz",
        sourceCategory: null,
      }),
    ).toBe("Jazz");
  });

  it("fallback sur Autre si rien d’autre", () => {
    expect(
      resolveCategoryBadgeLabel({
        category: "Autre",
        genre: "",
        sourceCategory: null,
      }),
    ).toBe("Autre");
  });
});

describe("mapDetourEventToEventItem — distance", () => {
  it("Saran sans coords → distance via fallback ville", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "saran:1",
        title: "Concert",
        city: "Saran",
        latitude: null,
        longitude: null,
      }),
    );
    expect(item.distanceKm).toBeCloseTo(
      distanceKmBetween(ORLEANS_CENTER, CITY_CENTER_FALLBACKS.saran),
      5,
    );
  });

  it("coords réelles → priorité aux coords événement", () => {
    const real = { latitude: 47.863, longitude: 1.9 };
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "saran:2",
        title: "Concert",
        city: "Saran",
        ...real,
      }),
    );
    expect(item.distanceKm).toBeCloseTo(
      distanceKmBetween(ORLEANS_CENTER, real),
      5,
    );
  });

  it("ville inconnue sans coords → distance undefined", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "x",
        title: "Concert",
        city: "Nulle Part",
      }),
    );
    expect(item.distanceKm).toBeUndefined();
  });
});
