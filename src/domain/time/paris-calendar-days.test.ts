import { describe, expect, it } from "vitest";
import { parisCalendarDaysBetween } from "@/domain/time/paris-calendar-days";

describe("parisCalendarDaysBetween", () => {
  it("compte les jours civils Paris jusqu’au début", () => {
    expect(
      parisCalendarDaysBetween(
        "2026-09-01T10:00:00+02:00",
        "2026-09-11T20:00:00+02:00",
      ),
    ).toBe(10);
  });

  it("gère le passage d’année", () => {
    expect(
      parisCalendarDaysBetween(
        "2026-12-28T15:00:00+01:00",
        "2027-01-02T10:00:00+01:00",
      ),
    ).toBe(5);
  });

  it("retourne null si ISO invalide", () => {
    expect(parisCalendarDaysBetween("nope", "2026-09-11T20:00:00+02:00")).toBe(
      null,
    );
  });
});
