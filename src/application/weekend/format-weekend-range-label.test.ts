import { describe, expect, it } from "vitest";
import { formatWeekendRangeLabel } from "@/application/weekend/format-weekend-range-label";
import { getDateRangeForWhenFilter } from "@/domain/time/when-filter";

describe("formatWeekendRangeLabel", () => {
  it("formate samedi–dimanche même mois", () => {
    const range = getDateRangeForWhenFilter(
      "weekend",
      new Date("2026-11-04T12:00:00+01:00"),
    );
    expect(formatWeekendRangeLabel(range.from, range.to!)).toBe(
      "samedi 7 et dimanche 8 novembre 2026",
    );
  });

  it("suit le week-end en cours un samedi", () => {
    const range = getDateRangeForWhenFilter(
      "weekend",
      new Date("2026-11-07T18:00:00+01:00"),
    );
    expect(formatWeekendRangeLabel(range.from, range.to!)).toBe(
      "samedi 7 et dimanche 8 novembre 2026",
    );
  });

  it("change de week-end le lundi suivant", () => {
    const before = getDateRangeForWhenFilter(
      "weekend",
      new Date("2026-11-08T23:00:00+01:00"),
    );
    const after = getDateRangeForWhenFilter(
      "weekend",
      new Date("2026-11-09T08:00:00+01:00"),
    );
    expect(formatWeekendRangeLabel(before.from, before.to!)).toBe(
      "samedi 7 et dimanche 8 novembre 2026",
    );
    expect(formatWeekendRangeLabel(after.from, after.to!)).toBe(
      "samedi 14 et dimanche 15 novembre 2026",
    );
  });
});
