import { describe, expect, it } from "vitest";
import type { PublicWeekendPage } from "@/application/weekend/get-public-weekend-page";
import { buildWeekendMetadata } from "@/features/weekend/weekend-seo";
import type { EventItem } from "@/data/types";

function page(overrides: Partial<PublicWeekendPage> = {}): PublicWeekendPage {
  return {
    saturdayKey: "2026-11-07",
    sundayKey: "2026-11-08",
    weekendLabel: "samedi 7 et dimanche 8 novembre 2026",
    weekendFromIso: "2026-11-06T23:00:00.000Z",
    weekendToIso: "2026-11-08T22:59:59.999Z",
    culturalActiveCount: 0,
    explorerHref: "/explorer",
    events: [],
    ...overrides,
  };
}

describe("buildWeekendMetadata", () => {
  it("indexe avec canonical quand la sélection est utile", () => {
    const metadata = buildWeekendMetadata(
      page({
        culturalActiveCount: 1,
        events: [
          {
            id: "a",
            title: "Concert",
            category: "Concert",
            genre: "",
            venue: null,
            city: "Orléans",
            date: "2026-11-07",
            dateLabel: "Sam. 7 nov.",
            distanceKm: 0,
          } as unknown as EventItem,
        ],
      }),
    );

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates).toEqual({
      canonical: "/orleans/ce-week-end",
    });
    expect(metadata.openGraph).toMatchObject({
      url: "/orleans/ce-week-end",
    });
    expect(String(metadata.description)).toContain("Samedi 7");
  });

  it("noindex l’état vide sans perdre le canonical", () => {
    const metadata = buildWeekendMetadata(page());
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({
      canonical: "/orleans/ce-week-end",
    });
    expect(String(metadata.description)).toMatch(/Aucune sortie culturelle/i);
  });
});
