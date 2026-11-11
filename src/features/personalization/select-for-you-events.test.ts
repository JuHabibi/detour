import { describe, expect, it } from "vitest";
import { selectForYouEvents } from "./select-for-you-events";
import type { ForYouCandidate, ForYouPreferences } from "./select-for-you-events";

describe("selectForYouEvents (feature reexport)", () => {
  it("filtre strictement sur les centres d’intérêt", () => {
    const pool: ForYouCandidate[] = [
      {
        id: "a",
        title: "Concert",
        category: "Musique",
        startAt: "2026-11-13T20:00:00+01:00",
      },
      {
        id: "b",
        title: "Pièce",
        category: "Spectacle",
        startAt: "2026-11-14T20:00:00+01:00",
      },
    ];
    const preferences: ForYouPreferences = {
      interests: ["Musique"],
      availabilities: ["flexible"],
      budget: "any",
    };
    expect(
      selectForYouEvents(
        pool,
        preferences,
        8,
        new Date("2026-11-11T12:00:00+01:00"),
      ).map((item) => item.id),
    ).toEqual(["a"]);
  });
});
