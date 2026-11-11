import { describe, expect, it } from "vitest";
import {
  selectForYouEvents,
  type ForYouCandidate,
  type ForYouPreferences,
} from "./select-for-you-events";

const NOW = new Date("2026-11-11T12:00:00+01:00");

function event(
  partial: Partial<ForYouCandidate> &
    Pick<ForYouCandidate, "id" | "title" | "category">,
): ForYouCandidate {
  return {
    startAt: "2026-11-14T20:00:00+01:00",
    venue: "Salle",
    ...partial,
  };
}

describe("selectForYouEvents", () => {
  it("ne garde que les centres d’intérêt déclarés", () => {
    const pool = [
      event({ id: "m", title: "Concert", category: "Musique" }),
      event({ id: "s", title: "Pièce", category: "Spectacle" }),
      event({ id: "c", title: "Film", category: "Cinéma" }),
    ];
    const preferences: ForYouPreferences = {
      interests: ["Cinéma", "Musique"],
      availabilities: ["flexible"],
      budget: "any",
    };
    const selected = selectForYouEvents(pool, preferences, 8, NOW);
    expect(selected.map((item) => item.id).sort()).toEqual(["c", "m"]);
  });

  it("aucune correspondance → liste vide (pas de hors catégorie)", () => {
    const pool = [
      event({ id: "s", title: "Pièce", category: "Spectacle" }),
      event({ id: "e", title: "Expo", category: "Exposition" }),
    ];
    const preferences: ForYouPreferences = {
      interests: ["Cinéma"],
      availabilities: ["flexible"],
      budget: "any",
    };
    expect(selectForYouEvents(pool, preferences, 8, NOW)).toEqual([]);
  });

  it("plusieurs catégories sélectionnées", () => {
    const pool = [
      event({ id: "1", title: "A", category: "Exposition" }),
      event({ id: "2", title: "B", category: "Atelier" }),
      event({ id: "3", title: "C", category: "Visite" }),
    ];
    const preferences: ForYouPreferences = {
      interests: ["Exposition", "Atelier"],
      availabilities: ["flexible"],
      budget: "any",
    };
    expect(selectForYouEvents(pool, preferences, 8, NOW).map((e) => e.id)).toEqual(
      ["1", "2"],
    );
  });

  it("disponibilités : semaine soir vs week-end jour (Europe/Paris)", () => {
    const pool = [
      event({
        id: "weekday-eve",
        title: "Jazz",
        category: "Musique",
        // mercredi 20h Paris
        startAt: "2026-11-11T20:00:00+01:00",
      }),
      event({
        id: "weekend-day",
        title: "Matinée",
        category: "Musique",
        // samedi 11h Paris
        startAt: "2026-11-14T11:00:00+01:00",
      }),
      event({
        id: "weekend-eve",
        title: "Soirée",
        category: "Musique",
        startAt: "2026-11-14T20:00:00+01:00",
      }),
    ];

    const weekday = selectForYouEvents(
      pool,
      {
        interests: ["Musique"],
        availabilities: ["weekday-evening"],
        budget: "any",
      },
      8,
      NOW,
    );
    expect(weekday[0]?.id).toBe("weekday-eve");

    const weekendDay = selectForYouEvents(
      pool,
      {
        interests: ["Musique"],
        availabilities: ["weekend-day"],
        budget: "any",
      },
      8,
      NOW,
    );
    expect(weekendDay[0]?.id).toBe("weekend-day");
  });

  it("fuseau Europe/Paris + changement d’heure (CEST)", () => {
    // 2026-03-29 01:30 UTC = 03:30 CEST après bascule ; samedi matin Paris.
    const afterDst = event({
      id: "dst",
      title: "Expo DST",
      category: "Exposition",
      startAt: "2026-03-29T01:30:00.000Z",
    });
    // Vendredi 23:30 UTC = samedi 00:30 CET (avant bascule mars 2025-like window).
    // Utiliser un samedi hiver clair : 2026-01-10 10:00 Paris = 09:00 UTC.
    const winterSaturday = event({
      id: "winter",
      title: "Expo hiver",
      category: "Exposition",
      startAt: "2026-01-10T09:00:00.000Z",
    });

    const selected = selectForYouEvents(
      [afterDst, winterSaturday],
      {
        interests: ["Exposition"],
        availabilities: ["weekend-day"],
        budget: "any",
      },
      8,
      new Date("2026-01-01T12:00:00+01:00"),
    );
    expect(selected.map((item) => item.id)).toEqual(["winter", "dst"]);
  });

  it("UTC minuit ne doit pas fausser le jour civil Paris", () => {
    // 2026-11-13T23:00:00Z = 2026-11-14 00:00 Europe/Paris (samedi)
    const eventAtParisMidnight = event({
      id: "paris-sat",
      title: "Minuit Paris",
      category: "Cinéma",
      startAt: "2026-11-13T23:00:00.000Z",
    });
    const selected = selectForYouEvents(
      [eventAtParisMidnight],
      {
        interests: ["Cinéma"],
        availabilities: ["weekend-day"],
        budget: "any",
      },
      8,
      NOW,
    );
    expect(selected).toHaveLength(1);
  });

  it("date absente / invalide ≠ correspondance disponibilité positive", () => {
    const pool = [
      event({
        id: "no-date",
        title: "Sans date",
        category: "Musique",
        startAt: null,
      }),
      event({
        id: "bad-date",
        title: "Bad",
        category: "Musique",
        startAt: "not-a-date",
      }),
      event({
        id: "ok",
        title: "OK",
        category: "Musique",
        startAt: "2026-11-11T20:00:00+01:00",
      }),
    ];
    const selected = selectForYouEvents(
      pool,
      {
        interests: ["Musique"],
        availabilities: ["weekday-evening"],
        budget: "any",
      },
      8,
      NOW,
    );
    expect(selected[0]?.id).toBe("ok");
  });

  it("free_preferred favorise le gratuit sans exclure le payant", () => {
    const pool = [
      event({
        id: "paid",
        title: "Payant",
        category: "Exposition",
        startAt: "2026-11-12T11:00:00+01:00",
        price: 12,
      }),
      event({
        id: "free",
        title: "Gratuit",
        category: "Exposition",
        startAt: "2026-11-13T11:00:00+01:00",
        conditions: "Gratuit",
      }),
    ];
    const selected = selectForYouEvents(
      pool,
      {
        interests: ["Exposition"],
        availabilities: ["flexible"],
        budget: "free_preferred",
      },
      8,
      NOW,
    );
    expect(selected.map((item) => item.id)).toEqual(["free", "paid"]);
  });

  it("budget any ne favorise pas artificiellement le gratuit", () => {
    const pool = [
      event({
        id: "paid-soon",
        title: "Payant proche",
        category: "Cinéma",
        startAt: "2026-11-12T15:00:00+01:00",
        price: 8,
      }),
      event({
        id: "free-later",
        title: "Gratuit plus tard",
        category: "Cinéma",
        startAt: "2026-11-20T15:00:00+01:00",
        conditions: "Entrée gratuite",
      }),
    ];
    const selected = selectForYouEvents(
      pool,
      {
        interests: ["Cinéma"],
        availabilities: ["flexible"],
        budget: "any",
      },
      8,
      NOW,
    );
    expect(selected[0]?.id).toBe("paid-soon");
  });

  it("tarif inconnu ≠ gratuit", () => {
    const pool = [
      event({
        id: "unknown",
        title: "Inconnu",
        category: "Visite",
        startAt: "2026-11-12T11:00:00+01:00",
        conditions: "Sur place",
      }),
      event({
        id: "free",
        title: "Libre",
        category: "Visite",
        startAt: "2026-11-13T11:00:00+01:00",
        conditions: "Gratuit",
      }),
    ];
    const selected = selectForYouEvents(
      pool,
      {
        interests: ["Visite"],
        availabilities: ["flexible"],
        budget: "free_preferred",
      },
      8,
      NOW,
    );
    expect(selected[0]?.id).toBe("free");
  });

  it("déduplique les ids et limite les séances / lieux", () => {
    const pool = [
      event({
        id: "a1",
        title: "Hamlet",
        category: "Spectacle",
        venue: "Théâtre",
        startAt: "2026-11-12T20:00:00+01:00",
      }),
      event({
        id: "a2",
        title: "Hamlet",
        category: "Spectacle",
        venue: "Théâtre",
        startAt: "2026-11-13T20:00:00+01:00",
      }),
      event({
        id: "b",
        title: "Autre pièce",
        category: "Spectacle",
        venue: "Théâtre",
        startAt: "2026-11-14T20:00:00+01:00",
      }),
      event({
        id: "c",
        title: "Encore",
        category: "Spectacle",
        venue: "Théâtre",
        startAt: "2026-11-15T20:00:00+01:00",
      }),
      event({
        id: "d",
        title: "Ailleurs",
        category: "Spectacle",
        venue: "Autre salle",
        startAt: "2026-11-16T20:00:00+01:00",
      }),
    ];
    const selected = selectForYouEvents(
      pool,
      {
        interests: ["Spectacle"],
        availabilities: ["flexible"],
        budget: "any",
      },
      8,
      NOW,
    );
    // Un seul Hamlet (séances dédupliquées par titre)
    expect(selected.filter((item) => item.title === "Hamlet")).toHaveLength(1);
    expect(selected.filter((item) => item.venue === "Théâtre").length).toBeLessThanOrEqual(
      2,
    );
    expect(selected.some((item) => item.id === "d")).toBe(true);
  });

  it("résultats stables à données identiques", () => {
    const pool = [
      event({
        id: "b",
        title: "B",
        category: "Musique",
        venue: "Lieu B",
        startAt: "2026-11-15T20:00:00+01:00",
      }),
      event({
        id: "a",
        title: "A",
        category: "Musique",
        venue: "Lieu A",
        startAt: "2026-11-14T20:00:00+01:00",
      }),
      event({
        id: "c",
        title: "C",
        category: "Musique",
        venue: "Lieu C",
        startAt: "2026-11-16T20:00:00+01:00",
      }),
    ];
    const preferences: ForYouPreferences = {
      interests: ["Musique"],
      availabilities: ["flexible"],
      budget: "any",
    };
    const first = selectForYouEvents(pool, preferences, 8, NOW).map((e) => e.id);
    const second = selectForYouEvents(pool, preferences, 8, NOW).map((e) => e.id);
    expect(first).toEqual(second);
    expect(first).toEqual(["a", "b", "c"]);
  });

  it("plafond à huit événements", () => {
    const pool = Array.from({ length: 12 }, (_, index) =>
      event({
        id: `e${index}`,
        title: `Event ${index}`,
        category: "Rencontre",
        venue: `Lieu ${index}`,
        startAt: `2026-11-${String(12 + (index % 18)).padStart(2, "0")}T18:00:00+01:00`,
      }),
    );
    const selected = selectForYouEvents(
      pool,
      {
        interests: ["Rencontre"],
        availabilities: ["flexible"],
        budget: "any",
      },
      8,
      NOW,
    );
    expect(selected).toHaveLength(8);
  });

  it("intérêts vides → aucune sélection", () => {
    expect(
      selectForYouEvents(
        [event({ id: "a", title: "A", category: "Musique" })],
        { interests: [], availabilities: ["flexible"], budget: "any" },
        8,
        NOW,
      ),
    ).toEqual([]);
  });
});
