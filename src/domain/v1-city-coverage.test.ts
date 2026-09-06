import { describe, expect, it } from "vitest";
import {
  buildV1CityCoverageReport,
  coverageLevel,
  matchV1Commune,
  normalizeCityKey,
} from "@/domain/v1-city-coverage";
import type { DetourEvent } from "@/domain/events/event";

function event(id: string, city: string | null): DetourEvent {
  return {
    id,
    title: id,
    description: null,
    imageUrl: id === "img" ? "https://example.com/x.jpg" : null,
    startAt: "2026-10-01T20:00:00+02:00",
    endAt: null,
    venue: null,
    city,
    latitude: id === "geo" ? 47.9 : null,
    longitude: id === "geo" ? 1.9 : null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda Test",
    sourceUrl: null,
    registrationUrl: id === "book" ? "https://example.com/book" : null,
  };
}

describe("v1 city coverage normalization", () => {
  it("unifie les variantes Saint-Jean-de-Braye", () => {
    expect(matchV1Commune("Saint-Jean-de-Braye")).toBe("Saint-Jean-de-Braye");
    expect(matchV1Commune("Saint Jean de Braye")).toBe("Saint-Jean-de-Braye");
    expect(matchV1Commune("ST JEAN DE BRAYE")).toBe("Saint-Jean-de-Braye");
    expect(normalizeCityKey("ST JEAN DE BRAYE")).toBe(
      normalizeCityKey("Saint-Jean-de-Braye"),
    );
  });

  it("ne fusionne pas deux communes distinctes", () => {
    expect(matchV1Commune("Saint-Jean-de-Braye")).not.toBe(
      matchV1Commune("Saint-Jean-de-la-Ruelle"),
    );
    expect(matchV1Commune("Saint-Jean-le-Blanc")).not.toBe(
      matchV1Commune("Saint-Jean-de-Braye"),
    );
  });

  it("coverage thresholds", () => {
    expect(coverageLevel(0)).toBe("none");
    expect(coverageLevel(1)).toBe("weak");
    expect(coverageLevel(5)).toBe("weak");
    expect(coverageLevel(6)).toBe("good");
  });

  it("build report agrège le périmètre V1", () => {
    const report = buildV1CityCoverageReport({
      events: [
        event("a", "Orléans"),
        event("b", "orleans"),
        event("c", "Olivet"),
        event("d", "Tours"),
        event("img", "Orléans"),
        event("book", "Orléans"),
        event("geo", "Orléans"),
      ],
      from: new Date("2026-09-04"),
      to: new Date("2027-03-03"),
      windowDays: 180,
    });

    expect(report.totalEventsOnV1).toBe(6);
    expect(report.rows.find((row) => row.commune === "Orléans")?.events).toBe(5);
    expect(report.rows.find((row) => row.commune === "Olivet")?.coverage).toBe(
      "weak",
    );
    expect(report.communesNone.length).toBeGreaterThan(0);
    expect(report.outsideV1Top[0]?.city).toBe("Tours");
  });
});
