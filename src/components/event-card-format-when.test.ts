import { describe, expect, it } from "vitest";
import { formatWhen } from "@/components/EventCard";
import type { EventItem } from "@/data/types";

function baseItem(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "e1",
    title: "Concert",
    category: "Musique",
    genre: "",
    venue: null,
    city: "Orléans",
    date: "2026-09-12",
    dateLabel: "Samedi 12 septembre",
    startAt: "2026-09-12T20:00:00+02:00",
    endAt: null,
    time: "20h00",
    ...overrides,
  };
}

describe("EventCard formatWhen", () => {
  it("single-day : compact date + time (comportement actuel)", () => {
    const label = formatWhen(baseItem());
    expect(label).toMatch(/12/);
    expect(label).toContain("20h00");
    expect(label).toMatch(/·/);
  });

  it("même jour civil avec endAt → compact + time, ignore dateLabel long", () => {
    const label = formatWhen(
      baseItem({
        endAt: "2026-09-12T22:00:00+02:00",
        dateLabel: "Samedi 12 septembre",
      }),
    );
    expect(label).toContain("20h00");
    expect(label).not.toBe("Samedi 12 septembre");
  });

  it("multi-day : utilise dateLabel plage, sans time", () => {
    const label = formatWhen(
      baseItem({
        date: "2026-09-04",
        dateLabel: "Du 4 au 27 sept.",
        startAt: "2026-09-04T14:00:00+02:00",
        endAt: "2026-09-27T18:00:00+02:00",
        time: "14h00",
      }),
    );
    expect(label).toBe("Du 4 au 27 sept.");
    expect(label).not.toContain("14h00");
  });

  it("multi-day futur : Du … au …", () => {
    const label = formatWhen(
      baseItem({
        date: "2026-09-10",
        dateLabel: "Du 10 au 27 sept.",
        startAt: "2026-09-10T14:00:00+02:00",
        endAt: "2026-09-27T18:00:00+02:00",
        time: undefined,
      }),
    );
    expect(label).toBe("Du 10 au 27 sept.");
  });
});
