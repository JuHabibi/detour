import { describe, expect, it } from "vitest";
import { parseOrleansOccurrences } from "./orleans-occurrences";

const first = { begin: "2026-10-02T18:00:00+02:00", end: "2026-10-02T20:00:00+02:00" };
const last = { begin: "2026-11-27T18:00:00+01:00", end: "2026-11-27T20:00:00+01:00" };

describe("parseOrleansOccurrences", () => {
  it("conserve seulement les séances réelles, trie et déduplique sans remplir les jours intermédiaires", () => {
    expect(parseOrleansOccurrences(JSON.stringify([last, first, { ...first, id: "source-id" }]))).toEqual([
      { startAt: "2026-10-02T16:00:00.000Z", endAt: "2026-10-02T18:00:00.000Z", allDay: false },
      { startAt: "2026-11-27T17:00:00.000Z", endAt: "2026-11-27T19:00:00.000Z", allDay: false },
    ]);
  });

  it("respecte les offsets lors du changement d’heure et les séances nocturnes", () => {
    const schedule = [
      { begin: "2026-10-25T02:30:00+02:00", end: "2026-10-25T02:30:00+01:00" },
      { begin: "2026-11-14T23:00:00+01:00", end: "2026-11-15T02:00:00+01:00" },
    ];
    expect(parseOrleansOccurrences(JSON.stringify(schedule))).toEqual([
      { startAt: "2026-10-25T00:30:00.000Z", endAt: "2026-10-25T01:30:00.000Z", allDay: false },
      { startAt: "2026-11-14T22:00:00.000Z", endAt: "2026-11-15T01:00:00.000Z", allDay: false },
    ]);
  });

  it("déduplique deux représentations du même instant", () => {
    expect(parseOrleansOccurrences(JSON.stringify([
      first,
      { begin: "2026-10-02T16:00:00Z", end: "2026-10-02T18:00:00Z" },
    ]))).toHaveLength(1);
  });

  it("distingue absence de calendrier et calendrier explicitement vide", () => {
    expect(parseOrleansOccurrences(undefined)).toBeUndefined();
    expect(parseOrleansOccurrences(null)).toBeUndefined();
    expect(parseOrleansOccurrences("[]")).toEqual([]);
  });

  it.each([
    "", "not-json", "{}", "null", [],
    JSON.stringify([first, null]),
    JSON.stringify([first, { begin: first.begin }]),
    JSON.stringify([{ begin: "2026-02-30T18:00:00+01:00", end: last.end }]),
    JSON.stringify([{ begin: "2026-11-27T18:00:00", end: last.end }]),
    JSON.stringify([{ begin: last.begin, end: first.end }]),
  ])("refuse tout le snapshot malformé (%j), sans conserver une fraction des séances", (input) => {
    expect(() => parseOrleansOccurrences(input)).toThrow("Orleans timings:");
  });
});
