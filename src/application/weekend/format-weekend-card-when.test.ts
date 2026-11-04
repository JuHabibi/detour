import { describe, expect, it } from "vitest";
import { formatWeekendCardWhen } from "@/application/weekend/format-weekend-card-when";

const WEEKEND = {
  saturdayKey: "2026-11-07",
  sundayKey: "2026-11-08",
} as const;

describe("formatWeekendCardWhen", () => {
  it("garde date · heure pour une occurrence ponctuelle du samedi", () => {
    expect(
      formatWeekendCardWhen(
        {
          startAt: "2026-11-07T18:00:00.000Z",
          endAt: "2026-11-07T20:00:00.000Z",
          date: "2026-11-07",
          time: "19:00",
          dateLabel: "Samedi 7 novembre",
        },
        WEEKEND,
      ),
    ).toBe("Sam. 7 nov. · 19:00");
  });

  it("borne une expo multi-jours au week-end sans inventer d’horaire", () => {
    expect(
      formatWeekendCardWhen(
        {
          allDay: true,
          startAt: "2026-10-31T23:00:00.000Z",
          // fin exclusive lundi 16 nov. 00:00 Paris
          endAt: "2026-11-15T23:00:00.000Z",
          dateLabel: "Du 1 au 15 nov.",
        },
        WEEKEND,
      ),
    ).toBe("Sam. 7 nov. – Dim. 8 nov.");
  });

  it("all-day samedi seul (fin exclusive dimanche 00:00) → jour inclusif sans heure", () => {
    expect(
      formatWeekendCardWhen(
        {
          allDay: true,
          startAt: "2026-11-06T23:00:00.000Z",
          endAt: "2026-11-07T23:00:00.000Z",
          dateLabel: "Samedi 7 novembre",
        },
        WEEKEND,
      ),
    ).toBe("Sam. 7 nov.");
  });

  it("événement commencé vendredi qui déborde samedi : jour week-end sans inventer l’heure", () => {
    expect(
      formatWeekendCardWhen(
        {
          startAt: "2026-11-06T21:00:00.000Z",
          endAt: "2026-11-07T01:00:00.000Z",
          time: "22:00",
          dateLabel: "Ven. 6 nov. · 22:00",
        },
        WEEKEND,
      ),
    ).toBe("Sam. 7 nov.");
  });

  it("occurrences distinctes : chaque carte reste sur son jour/heure", () => {
    expect(
      formatWeekendCardWhen(
        {
          startAt: "2026-11-07T18:30:00.000Z",
          endAt: "2026-11-07T20:00:00.000Z",
          time: "19:30",
        },
        WEEKEND,
      ),
    ).toBe("Sam. 7 nov. · 19:30");

    expect(
      formatWeekendCardWhen(
        {
          startAt: "2026-11-08T13:00:00.000Z",
          endAt: "2026-11-08T14:30:00.000Z",
          time: "14:00",
        },
        WEEKEND,
      ),
    ).toBe("Dim. 8 nov. · 14:00");
  });
});
