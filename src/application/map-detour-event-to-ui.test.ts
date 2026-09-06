import { describe, expect, it } from "vitest";
import {
  mapDetourEventToEventItem,
  mapDetourHighlightToEventItem,
  resolveCategoryBadgeLabel,
} from "@/application/map-detour-event-to-ui";
import type { DetourEvent } from "@/domain/event";
import type { EventHighlight } from "@/domain/select-detour-highlights";
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

describe("mapDetourHighlightToEventItem — pastille éditoriale", () => {
  function highlight(
    overrides: {
      registrationUrl?: string | null;
      ai?: EventHighlight["aiSelection"];
    } = {},
  ): EventHighlight {
    return {
      event: baseEvent({
        id: "h1",
        title: "Spectacle",
        registrationUrl: overrides.registrationUrl ?? null,
      }),
      score: 10,
      planningScore: 2,
      reasons: ["headline-appeal"],
      selectionSource: "ai",
      aiSelection: overrides.ai,
    };
  }

  it("attache À réserver depuis assessment + registrationUrl", () => {
    const item = mapDetourHighlightToEventItem(
      highlight({
        registrationUrl: "https://book.example",
        ai: {
          formula: "strong",
          slotScore: 12,
          appeal: 4,
          missRisk: 2,
          planningNeed: 4,
          localRarity: 5,
          likelyDemand: 4,
          confidence: 0.8,
          aiReasons: [],
        },
      }),
    );
    expect(item.editorialBadge).toBe("À réserver");
  });

  it("sans aiSelection → pas de pastille", () => {
    const item = mapDetourHighlightToEventItem(highlight());
    expect(item.editorialBadge).toBeUndefined();
  });
});

describe("mapDetourEventToEventItem — labels multi-jours", () => {
  it("single-day : dateLabel long + time inchangés", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "single",
        title: "Concert",
        startAt: "2026-09-12T20:00:00+02:00",
        endAt: null,
      }),
    );
    expect(item.dateLabel).toMatch(/samedi/i);
    expect(item.dateLabel).toMatch(/12/);
    expect(item.time).toBe("20h00");
  });

  it("même jour civil Paris avec endAt → single-day (avec heure)", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "same-day",
        title: "Atelier",
        startAt: "2026-09-12T14:00:00+02:00",
        endAt: "2026-09-12T18:00:00+02:00",
      }),
    );
    expect(item.dateLabel).toMatch(/samedi/i);
    expect(item.time).toBe("14h00");
  });

  it("multi-day futur => Du … au …, sans time", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "future-range",
        title: "Expo",
        startAt: "2026-09-10T14:00:00+02:00",
        endAt: "2026-09-27T18:00:00+02:00",
      }),
    );
    expect(item.dateLabel).toBe("Du 10 au 27 sept.");
    expect(item.time).toBeUndefined();
  });

  it("multi-day déjà commencé => Du … au … (pas Jusqu’au), sans time", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "ongoing",
        title: "Exposition - Un regard sur le vivant",
        startAt: "2026-09-04T14:00:00+02:00",
        endAt: "2026-09-27T18:00:00+02:00",
      }),
    );
    expect(item.dateLabel).toBe("Du 4 au 27 sept.");
    expect(item.time).toBeUndefined();
  });

  it("plage sur deux mois", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "cross-month",
        title: "Expo",
        startAt: "2026-08-28T10:00:00+02:00",
        endAt: "2026-09-02T18:00:00+02:00",
      }),
    );
    expect(item.dateLabel).toBe("Du 28 août au 2 sept.");
    expect(item.time).toBeUndefined();
  });

  it("timezone Europe/Paris : UTC minuit peut basculer de jour civil", () => {
    // 2026-09-04T22:00:00Z = 2026-09-05 00:00 Europe/Paris
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "tz",
        title: "Expo",
        startAt: "2026-09-04T22:00:00.000Z",
        endAt: "2026-09-27T16:00:00.000Z",
      }),
    );
    expect(item.dateLabel).toBe("Du 5 au 27 sept.");
    expect(item.time).toBeUndefined();
  });

  it("endAt invalide ou antérieur à startAt → fallback single-day", () => {
    const invalid = mapDetourEventToEventItem(
      baseEvent({
        id: "bad-end",
        title: "Concert",
        startAt: "2026-09-12T20:00:00+02:00",
        endAt: "not-a-date",
      }),
    );
    expect(invalid.time).toBe("20h00");
    expect(invalid.dateLabel).toMatch(/samedi/i);

    const inverted = mapDetourEventToEventItem(
      baseEvent({
        id: "inverted",
        title: "Concert",
        startAt: "2026-09-12T20:00:00+02:00",
        endAt: "2026-09-10T20:00:00+02:00",
      }),
    );
    expect(inverted.time).toBe("20h00");
    expect(inverted.dateLabel).toMatch(/samedi/i);
  });
});
