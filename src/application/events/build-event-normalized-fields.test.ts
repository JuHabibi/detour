import { describe, expect, it } from "vitest";
import { buildEventNormalizedFields } from "@/application/events/build-event-normalized-fields";
import { classifyEventCategory } from "@/domain/events/classify-event-category";
import type { DetourEvent } from "@/domain/events/event";

function event(overrides: Partial<DetourEvent> = {}): DetourEvent {
  return {
    id: "e1",
    title: "Concert jazz",
    description: null,
    imageUrl: null,
    startAt: "2026-11-01T20:00:00.000Z",
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

describe("buildEventNormalizedFields", () => {
  it("product_category = classifyEventCategory", () => {
    const sample = event({
      title: "Exposition photo",
      category: "Exposition",
    });
    const fields = buildEventNormalizedFields(sample);
    expect(fields.productCategory).toBe(classifyEventCategory(sample));
    expect(fields.productCategory).toBe("Exposition");
  });

  it("city_key canonique Orléans", () => {
    expect(buildEventNormalizedFields(event({ city: "Orléans" })).cityKey).toBe(
      "Orléans",
    );
    expect(buildEventNormalizedFields(event({ city: "orleans" })).cityKey).toBe(
      "Orléans",
    );
  });

  it("city_key unifie variantes Saint-Jean", () => {
    expect(
      buildEventNormalizedFields(event({ city: "ST JEAN DE BRAYE" })).cityKey,
    ).toBe("Saint-Jean-de-Braye");
    expect(
      buildEventNormalizedFields(event({ city: "Saint Jean de Braye" }))
        .cityKey,
    ).toBe("Saint-Jean-de-Braye");
  });

  it("city_key null si commune inconnue", () => {
    expect(
      buildEventNormalizedFields(event({ city: "Tours" })).cityKey,
    ).toBeNull();
    expect(buildEventNormalizedFields(event({ city: null })).cityKey).toBeNull();
  });
});
