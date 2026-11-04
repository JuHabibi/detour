import { describe, expect, it } from "vitest";
import {
  listCulturalActiveWeekendEvents,
  selectWeekendPageEvents,
} from "@/application/weekend/select-weekend-events";
import type { DetourEvent } from "@/domain/events/event";

function event(overrides: Partial<DetourEvent> = {}): DetourEvent {
  return {
    id: "evt-1",
    title: "Concert test",
    description: "Un spectacle musical avec billetterie",
    imageUrl: null,
    startAt: "2026-11-07T19:00:00.000Z",
    endAt: "2026-11-07T21:00:00.000Z",
    venue: "Scène nationale",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Concert",
    genre: null,
    conditions: null,
    source: "test",
    sourceUrl: "https://example.com/event",
    registrationUrl: "https://example.com/book",
    ...overrides,
  };
}

describe("selectWeekendPageEvents", () => {
  const now = new Date("2026-11-06T10:00:00.000Z");

  it("exclut les événements hors culture et ceux déjà terminés", () => {
    const selected = selectWeekendPageEvents(
      [
        event({
          id: "culture-ok",
          title: "Concert jazz avec artiste",
          category: "Concert",
          description: "Spectacle musical live",
          registrationUrl: "https://example.com/a",
        }),
        event({
          id: "ended",
          title: "Théâtre hier",
          category: "Spectacle",
          description: "Une pièce de théâtre",
          startAt: "2026-11-05T18:00:00.000Z",
          endAt: "2026-11-05T20:00:00.000Z",
          registrationUrl: "https://example.com/b",
        }),
        event({
          id: "sport",
          title: "Course cycliste",
          category: "Sport",
          description: "Compétition sportive",
          registrationUrl: null,
        }),
      ],
      { now, limit: 8 },
    );

    expect(selected.map((item) => item.id)).toEqual(["culture-ok"]);
  });

  it("respecte les bornes all-day exclusives via isEventStillActive", () => {
    // all-day samedi : endAt = dimanche 00:00 Paris exclusive → encore actif samedi soir
    const saturdayEvening = new Date("2026-11-07T20:00:00+01:00");
    const active = selectWeekendPageEvents(
      [
        event({
          id: "all-day",
          title: "Exposition week-end",
          category: "Exposition",
          description: "Une exposition au musée",
          allDay: true,
          startAt: "2026-11-07T00:00:00+01:00",
          endAt: "2026-11-08T00:00:00+01:00",
          registrationUrl: null,
        }),
      ],
      { now: saturdayEvening, limit: 8 },
    );
    expect(active.map((item) => item.id)).toEqual(["all-day"]);

    const afterExclusiveEnd = new Date("2026-11-08T00:00:01+01:00");
    const gone = selectWeekendPageEvents(
      [
        event({
          id: "all-day",
          title: "Exposition week-end",
          category: "Exposition",
          description: "Une exposition au musée",
          allDay: true,
          startAt: "2026-11-07T00:00:00+01:00",
          endAt: "2026-11-08T00:00:00+01:00",
          registrationUrl: null,
        }),
      ],
      { now: afterExclusiveEnd, limit: 8 },
    );
    expect(gone).toEqual([]);
  });

  it("reste vide si aucun candidat culturel scorable", () => {
    expect(
      selectWeekendPageEvents(
        [
          event({
            id: "yoga",
            title: "Cours de yoga",
            category: "Bien-être",
            description: "Séance de yoga",
            registrationUrl: null,
          }),
        ],
        { now, limit: 8 },
      ),
    ).toEqual([]);
  });

  it("conserve un tri stable score → planning → startAt", () => {
    const selected = selectWeekendPageEvents(
      [
        event({
          id: "b",
          title: "Concert B avec Marie Dupont",
          category: "Concert",
          description: "Spectacle musical",
          startAt: "2026-11-08T18:00:00.000Z",
          endAt: "2026-11-08T20:00:00.000Z",
          registrationUrl: "https://example.com/b",
        }),
        event({
          id: "a",
          title: "Concert A avec Jean Martin",
          category: "Concert",
          description: "Spectacle musical",
          startAt: "2026-11-07T18:00:00.000Z",
          endAt: "2026-11-07T20:00:00.000Z",
          registrationUrl: "https://example.com/a",
        }),
      ],
      { now, limit: 8 },
    );

    expect(selected.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("ne dépasse pas la limite et ne remplit pas artificiellement", () => {
    const pool = Array.from({ length: 12 }, (_, index) =>
      event({
        id: `c-${index}`,
        title: `Concert ${index} avec Artiste Nom`,
        category: "Concert",
        description: "Spectacle musical live",
        startAt: `2026-11-07T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
        endAt: `2026-11-07T${String(11 + index).padStart(2, "0")}:00:00.000Z`,
        registrationUrl: `https://example.com/${index}`,
      }),
    );

    expect(selectWeekendPageEvents(pool, { now, limit: 3 })).toHaveLength(3);
    expect(listCulturalActiveWeekendEvents(pool, now).length).toBeGreaterThan(3);
  });

  it("garde les occurrences distinctes (ids différents)", () => {
    const selected = selectWeekendPageEvents(
      [
        event({
          id: "show-sat",
          title: "Bonne année toi-même",
          category: "Spectacle",
          description: "Humour sur scène",
          startAt: "2026-11-07T19:30:00.000Z",
          endAt: "2026-11-07T21:00:00.000Z",
          registrationUrl: "https://example.com/sat",
        }),
        event({
          id: "show-sun",
          title: "Bonne année toi-même",
          category: "Spectacle",
          description: "Humour sur scène",
          startAt: "2026-11-08T14:00:00.000Z",
          endAt: "2026-11-08T15:30:00.000Z",
          registrationUrl: "https://example.com/sun",
        }),
      ],
      { now, limit: 8 },
    );

    expect(selected.map((item) => item.id).sort()).toEqual([
      "show-sat",
      "show-sun",
    ]);
  });
});
