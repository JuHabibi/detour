import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { DetourEvent } from "@/domain/events/event";
import {
  isOtherParisCalendarYear,
  parisCalendarYear,
} from "@/domain/time/paris-calendar-year";
import { formatWhen } from "@/features/home/components/EventCard";

function baseEvent(
  overrides: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    startAt: "2026-09-12T20:00:00+02:00",
    endAt: null,
    venue: null,
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    ...overrides,
  };
}

describe("parisCalendarYear", () => {
  it("lit l’année civile Europe/Paris", () => {
    expect(parisCalendarYear(new Date("2026-12-31T23:30:00.000Z"))).toBe(
      "2027",
    );
    expect(parisCalendarYear(new Date("2026-09-25T12:00:00+02:00"))).toBe(
      "2026",
    );
  });
});

describe("isOtherParisCalendarYear", () => {
  it("compare à now fourni", () => {
    const now = new Date("2026-09-25T12:00:00+02:00");
    expect(
      isOtherParisCalendarYear(new Date("2026-11-10T20:00:00+01:00"), now),
    ).toBe(false);
    expect(
      isOtherParisCalendarYear(new Date("2027-03-10T20:00:00+01:00"), now),
    ).toBe(true);
  });
});

describe("affichage année — dateLabel + formatWhen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T12:00:00+02:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("année courante : pas d’année (label long + carte compacte)", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "same-year",
        title: "Concert",
        startAt: "2026-11-12T20:00:00+01:00",
        endAt: null,
      }),
    );
    expect(item.dateLabel).toMatch(/novembre/i);
    expect(item.dateLabel).not.toMatch(/2026/);
    expect(formatWhen(item)).toMatch(/12/);
    expect(formatWhen(item)).not.toMatch(/2026/);
    expect(formatWhen(item)).toContain("20h00");
  });

  it("année suivante : année visible (modale + carte)", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "next-year",
        title: "Concert",
        startAt: "2027-03-10T20:00:00+01:00",
        endAt: null,
      }),
    );
    expect(item.dateLabel).toMatch(/2027/);
    expect(item.dateLabel).toMatch(/mars/i);
    const card = formatWhen(item);
    expect(card).toMatch(/2027/);
    expect(card).toContain("20h00");
    // Format compact sans weekday pour laisser l’année lisible
    expect(card).not.toMatch(/mer\.|jeu\.|ven\.|sam\.|dim\./i);
  });

  it("plage à cheval sur deux années : les deux années", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "cross-year",
        title: "Expo",
        startAt: "2026-12-28T10:00:00+01:00",
        endAt: "2027-01-02T18:00:00+01:00",
      }),
    );
    expect(item.dateLabel).toBe("Du 28 déc. 2026 au 2 janv. 2027");
    expect(formatWhen(item)).toBe("Du 28 déc. 2026 au 2 janv. 2027");
  });

  it("plage année suivante (même année) : suffixe année", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "next-year-range",
        title: "Expo",
        startAt: "2027-02-10T14:00:00+01:00",
        endAt: "2027-02-27T18:00:00+01:00",
      }),
    );
    expect(item.dateLabel).toBe("Du 10 au 27 févr. 2027");
  });

  it("all-day année suivante utilise dateLabel avec année", () => {
    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "allday-2027",
        title: "Journée",
        startAt: "2027-01-15T00:00:00+01:00",
        endAt: "2027-01-16T00:00:00+01:00",
        allDay: true,
      }),
    );
    expect(item.dateLabel).toMatch(/2027/);
    expect(formatWhen(item)).toBe(item.dateLabel);
  });
});
