import { describe, expect, it } from "vitest";
import {
  getDateRangeForWhenFilter,
  isDateInRange,
  isEventInWhenFilter,
} from "@/domain/when-filter";

function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    hour: Number(read("hour")),
  };
}

describe("getDateRangeForWhenFilter", () => {
  it("couvre aujourd’hui (jour civil Paris)", () => {
    const now = new Date("2026-09-10T15:30:00+02:00");
    const range = getDateRangeForWhenFilter("today", now);
    expect(parisParts(range.from)).toMatchObject({ date: "2026-09-10", hour: 0 });
    expect(parisParts(range.to!)).toMatchObject({ date: "2026-09-10" });
    expect(isDateInRange(new Date("2026-09-10T09:00:00+02:00"), range)).toBe(true);
    expect(isDateInRange(new Date("2026-09-11T09:00:00+02:00"), range)).toBe(false);
  });

  it("couvre demain", () => {
    const now = new Date("2026-09-10T15:30:00+02:00");
    const range = getDateRangeForWhenFilter("tomorrow", now);
    expect(parisParts(range.from).date).toBe("2026-09-11");
    expect(parisParts(range.to!).date).toBe("2026-09-11");
  });

  it("prend le prochain week-end depuis un mercredi", () => {
    const now = new Date("2026-09-09T11:00:00+02:00");
    const range = getDateRangeForWhenFilter("weekend", now);
    expect(parisParts(range.from).date).toBe("2026-09-12");
    expect(parisParts(range.to!).date).toBe("2026-09-13");
  });

  it("prend le week-end en cours depuis un samedi", () => {
    const now = new Date("2026-09-12T10:00:00+02:00");
    const range = getDateRangeForWhenFilter("weekend", now);
    expect(parisParts(range.from).date).toBe("2026-09-12");
    expect(parisParts(range.to!).date).toBe("2026-09-13");
  });

  it("calcule la semaine prochaine", () => {
    const now = new Date("2026-09-09T11:00:00+02:00");
    const range = getDateRangeForWhenFilter("next-week", now);
    expect(parisParts(range.from).date).toBe("2026-09-14");
    expect(parisParts(range.to!).date).toBe("2026-09-20");
  });

  it("gère la fin de mois pour ce mois-ci", () => {
    const now = new Date("2026-09-28T09:00:00+02:00");
    const range = getDateRangeForWhenFilter("this-month", now);
    expect(parisParts(range.from).date).toBe("2026-09-28");
    expect(parisParts(range.to!).date).toBe("2026-09-30");
  });

  it("passe décembre → janvier pour le mois prochain", () => {
    const now = new Date("2026-12-20T09:00:00+01:00");
    const range = getDateRangeForWhenFilter("next-month", now);
    expect(parisParts(range.from).date).toBe("2027-01-01");
    expect(parisParts(range.to!).date).toBe("2027-01-31");
  });

  it("calcule le mois prochain en cours d’année", () => {
    const now = new Date("2026-09-10T09:00:00+02:00");
    const range = getDateRangeForWhenFilter("next-month", now);
    expect(parisParts(range.from).date).toBe("2026-10-01");
    expect(parisParts(range.to!).date).toBe("2026-10-31");
  });

  it("laisse À venir sans borne haute", () => {
    const now = new Date("2026-09-10T15:30:00+02:00");
    const range = getDateRangeForWhenFilter("upcoming", now);
    expect(range.from.getTime()).toBe(now.getTime());
    expect(range.to).toBeNull();
    expect(isDateInRange(new Date("2026-12-01T12:00:00+01:00"), range)).toBe(true);
    expect(isDateInRange(new Date("2026-09-10T14:00:00+02:00"), range)).toBe(false);
  });
});

describe("isEventInWhenFilter", () => {
  it("conserve un événement d’un jour dans la période", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    expect(
      isEventInWhenFilter(
        "2026-09-10T18:00:00+02:00",
        "2026-09-10T20:00:00+02:00",
        "today",
        now,
      ),
    ).toBe(true);
  });

  it("conserve un événement commencé avant aujourd’hui mais encore en cours", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    expect(
      isEventInWhenFilter(
        "2026-09-08T10:00:00+02:00",
        "2026-09-12T18:00:00+02:00",
        "today",
        now,
      ),
    ).toBe(true);
  });

  it("conserve un événement multi-jours qui intersecte le week-end", () => {
    // mercredi → week-end = sam. 12 / dim. 13
    const now = new Date("2026-09-09T11:00:00+02:00");
    expect(
      isEventInWhenFilter(
        "2026-09-11T10:00:00+02:00",
        "2026-09-13T18:00:00+02:00",
        "weekend",
        now,
      ),
    ).toBe(true);
  });

  it("rejette un événement complètement terminé avant la période", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    expect(
      isEventInWhenFilter(
        "2026-09-08T10:00:00+02:00",
        "2026-09-09T18:00:00+02:00",
        "today",
        now,
      ),
    ).toBe(false);
  });

  it("rejette un événement qui commence après la période", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    expect(
      isEventInWhenFilter(
        "2026-09-11T10:00:00+02:00",
        "2026-09-11T18:00:00+02:00",
        "today",
        now,
      ),
    ).toBe(false);
  });

  it("conserve en upcoming un événement commencé mais encore actif", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    expect(
      isEventInWhenFilter(
        "2026-09-08T10:00:00+02:00",
        "2026-09-12T18:00:00+02:00",
        "upcoming",
        now,
      ),
    ).toBe(true);
  });

  it("traite endAt null comme un événement ponctuel (end = start)", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    expect(
      isEventInWhenFilter("2026-09-10T18:00:00+02:00", null, "today", now),
    ).toBe(true);
    expect(
      isEventInWhenFilter("2026-09-11T18:00:00+02:00", null, "today", now),
    ).toBe(false);
  });
});
