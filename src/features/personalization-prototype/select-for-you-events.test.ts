import { describe, expect, it } from "vitest";
import type { EventItem } from "@/data/types";
import { selectForYouEvents } from "./select-for-you-events";
import type { PersonalizationPreferences } from "./types";

function event(
  partial: Partial<EventItem> & Pick<EventItem, "id" | "title" | "category">,
): EventItem {
  return {
    genre: "",
    venue: "Salle",
    city: "Orléans",
    date: "2026-11-12",
    dateLabel: "12 nov.",
    startAt: "2026-11-12T20:00:00+01:00",
    ...partial,
  };
}

describe("selectForYouEvents", () => {
  it("priorise les centres d’intérêt choisis", () => {
    const pool = [
      event({
        id: "a",
        title: "Concert",
        category: "Musique",
        startAt: "2026-11-13T20:00:00+01:00",
        price: 12,
      }),
      event({
        id: "b",
        title: "Pièce",
        category: "Spectacle",
        startAt: "2026-11-14T20:00:00+01:00",
        price: 25,
      }),
      event({
        id: "c",
        title: "Film",
        category: "Cinéma",
        startAt: "2026-11-15T15:00:00+01:00",
        price: "free",
      }),
    ];

    const preferences: PersonalizationPreferences = {
      interests: ["Cinéma", "Musique"],
      availabilities: ["flexible"],
      budget: "under-15",
    };

    const selected = selectForYouEvents(pool, preferences, 3);
    expect(selected.map((item) => item.id)).toEqual(["c", "a"]);
  });
});
