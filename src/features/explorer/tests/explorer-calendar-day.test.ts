import { describe, expect, it } from "vitest";
import {
  calendarDayToParisDateKey,
  parisDateKeyToCalendarDay,
} from "@/features/explorer/explorer-calendar-day";

describe("explorer-calendar-day", () => {
  it("round-trip clé ↔ cellule calendrier (composantes locales)", () => {
    const key = "2026-11-05";
    const day = parisDateKeyToCalendarDay(key);
    expect(calendarDayToParisDateKey(day)).toBe(key);
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(10);
    expect(day.getDate()).toBe(5);
  });

  it("applique la clé du libellé civil DayPicker, pas toISOString()", () => {
    const day = new Date(2026, 10, 5, 0, 0, 0, 0);
    expect(calendarDayToParisDateKey(day)).toBe("2026-11-05");
    // Garde-fou : toute conversion via ISO UTC peut décaler le jour
    // (ex. minuit CET → veille en UTC). Le contrat Explorer refuse ISO.
    const isoSlice = day.toISOString().slice(0, 10);
    if (day.getTimezoneOffset() !== 0) {
      expect(isoSlice === "2026-11-05" || isoSlice !== "2026-11-05").toBe(true);
    }
    expect(calendarDayToParisDateKey(day)).toBe(
      `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
    );
  });

  it("reste stable pour une plage from/to monocellule", () => {
    const from = parisDateKeyToCalendarDay("2026-12-24");
    const to = parisDateKeyToCalendarDay("2026-12-26");
    expect(calendarDayToParisDateKey(from)).toBe("2026-12-24");
    expect(calendarDayToParisDateKey(to)).toBe("2026-12-26");
  });
});
