import { describe, expect, it } from "vitest";
import type { DetourEvent } from "@/domain/events/event";
import {
  buildEventCalendar,
  buildEventsCalendar,
  calendarDateInParis,
  escapeText,
  eventCalendarFilename,
  eventCalendarPath,
  eventCalendarUid,
  foldLine,
  formatLocation,
  groupCalendarFilename,
  groupCalendarPath,
  slugifyTitle,
} from "@/domain/calendar/build-event-calendar";

function event(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title" | "startAt">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    endAt: null,
    venue: null,
    city: null,
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    ...partial,
  };
}

const NOW = new Date("2026-09-16T12:00:00.000Z");

describe("buildEventCalendar", () => {
  it("produit un VEVENT valide (timed + endAt)", () => {
    const ics = buildEventCalendar(
      event({
        id: "openagenda:1",
        title: "Concert jazz",
        startAt: "2026-10-12T18:00:00.000Z",
        endAt: "2026-10-12T20:00:00.000Z",
        venue: "Scène nationale",
        city: "Orléans",
        description: "Soirée live",
        registrationUrl: "https://billets.example/1",
      }),
      { now: NOW },
    );

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:-//Detour//Calendar//FR\r\n");
    expect(ics).toContain("METHOD:PUBLISH\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("UID:openagenda:1@detour\r\n");
    expect(ics).toContain("DTSTAMP:20260916T120000Z\r\n");
    expect(ics).toContain("SUMMARY:Concert jazz\r\n");
    expect(ics).toContain("DTSTART:20261012T180000Z\r\n");
    expect(ics).toContain("DTEND:20261012T200000Z\r\n");
    expect(ics).toContain("LOCATION:Scène nationale\\, Orléans\r\n");
    expect(ics).toContain("DESCRIPTION:Soirée live\r\n");
    expect(ics).toContain("URL:https://billets.example/1\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("UID stable entre deux générations (DTSTAMP peut varier)", () => {
    const base = event({
      id: "saran:abc",
      title: "Expo",
      startAt: "2026-11-01T19:00:00.000Z",
    });
    const a = buildEventCalendar(base, {
      now: new Date("2026-09-16T12:00:00.000Z"),
    });
    const b = buildEventCalendar(base, {
      now: new Date("2026-09-17T08:00:00.000Z"),
    });
    expect(eventCalendarUid("saran:abc")).toBe("saran:abc@detour");
    expect(a).toContain("UID:saran:abc@detour");
    expect(b).toContain("UID:saran:abc@detour");
    expect(a).toContain("DTSTAMP:20260916T120000Z");
    expect(b).toContain("DTSTAMP:20260917T080000Z");
  });

  it("timed sans endAt → fallback +2h", () => {
    const ics = buildEventCalendar(
      event({
        id: "e1",
        title: "Show",
        startAt: "2026-10-12T18:00:00.000Z",
      }),
      { now: NOW },
    );
    expect(ics).toContain("DTSTART:20261012T180000Z\r\n");
    expect(ics).toContain("DTEND:20261012T200000Z\r\n");
  });

  it("all-day sans endAt → VALUE=DATE + fin exclusive J+1 (Paris)", () => {
    const ics = buildEventCalendar(
      event({
        id: "ingre:1",
        title: "Atelier",
        startAt: "2026-09-12T00:00:00+02:00",
        allDay: true,
      }),
      { now: NOW },
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20260912\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260913\r\n");
  });

  it("all-day avec endAt exclusif (Paris)", () => {
    const ics = buildEventCalendar(
      event({
        id: "saran:day",
        title: "Journée",
        startAt: "2026-09-20T00:00:00+02:00",
        endAt: "2026-09-21T00:00:00+02:00",
        allDay: true,
      }),
      { now: NOW },
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20260920\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260921\r\n");
  });

  it("all-day stocké en UTC Z conserve le jour civil Paris (DST)", () => {
    // 12 sept. 00:00 Paris (CEST) → 11 sept. 22:00Z
    expect(calendarDateInParis("2026-09-11T22:00:00.000Z")).toEqual({
      year: 2026,
      month: 9,
      day: 12,
    });
    const ics = buildEventCalendar(
      event({
        id: "dst",
        title: "Fête",
        startAt: "2026-09-11T22:00:00.000Z",
        allDay: true,
      }),
      { now: NOW },
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20260912\r\n");
  });

  it("escaping \\ ; , et multilignes", () => {
    const ics = buildEventCalendar(
      event({
        id: "e",
        title: "A;B,C\\D",
        startAt: "2026-10-01T10:00:00.000Z",
        description: "Ligne1\nLigne2\r\nLigne3",
      }),
      { now: NOW },
    );
    expect(ics).toContain("SUMMARY:A\\;B\\,C\\\\D\r\n");
    expect(ics).toContain("DESCRIPTION:Ligne1\\nLigne2\\nLigne3\r\n");
  });

  it("UTF-8 accents dans SUMMARY", () => {
    const ics = buildEventCalendar(
      event({
        id: "e",
        title: "Création théâtrale — été",
        startAt: "2026-10-01T10:00:00.000Z",
      }),
      { now: NOW },
    );
    expect(ics).toContain("SUMMARY:Création théâtrale — été\r\n");
  });

  it("lieu : manquant / ville seule / venue+city / sans doublon", () => {
    expect(formatLocation(null, null)).toBeNull();
    expect(formatLocation(null, "Orléans")).toBe("Orléans");
    expect(formatLocation("Scène", null)).toBe("Scène");
    expect(formatLocation("Scène", "Orléans")).toBe("Scène, Orléans");
    expect(formatLocation("Orléans", "Orléans")).toBe("Orléans");
  });

  it("sans description / sans URL", () => {
    const ics = buildEventCalendar(
      event({
        id: "e",
        title: "Minimal",
        startAt: "2026-10-01T10:00:00.000Z",
      }),
      { now: NOW },
    );
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("URL:");
  });

  it("URL préfère registrationUrl à sourceUrl", () => {
    const ics = buildEventCalendar(
      event({
        id: "e",
        title: "T",
        startAt: "2026-10-01T10:00:00.000Z",
        registrationUrl: "https://book.example",
        sourceUrl: "https://source.example",
      }),
      { now: NOW },
    );
    expect(ics).toContain("URL:https://book.example\r\n");
    expect(ics).not.toContain("source.example");
  });

  it("CRLF sur chaque ligne", () => {
    const ics = buildEventCalendar(
      event({
        id: "e",
        title: "T",
        startAt: "2026-10-01T10:00:00.000Z",
      }),
      { now: NOW },
    );
    expect(ics.includes("\n") && !ics.replace(/\r\n/g, "").includes("\n")).toBe(
      true,
    );
  });
});

describe("escapeText / foldLine / slug", () => {
  it("escapeText", () => {
    expect(escapeText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });

  it("foldLine > 75 octets", () => {
    const long = `DESCRIPTION:${"é".repeat(80)}`;
    const folded = foldLine(long);
    expect(folded).toContain("\r\n ");
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
  });

  it("slugify / filename / path", () => {
    expect(slugifyTitle("Création ! Jazz")).toBe("creation-jazz");
    expect(slugifyTitle("@@@")).toBe("event");
    expect(eventCalendarFilename("Week-end Loire")).toBe(
      "detour-week-end-loire.ics",
    );
    expect(eventCalendarPath("openagenda:1")).toBe(
      "/api/events/openagenda%3A1/calendar",
    );
    expect(groupCalendarFilename("Week-end Loire")).toBe(
      "detour-week-end-loire.ics",
    );
    expect(groupCalendarFilename("Week-end Loire", { selection: true })).toBe(
      "detour-week-end-loire-selection.ics",
    );
    expect(groupCalendarPath("g1")).toBe("/api/account/groups/g1/calendar");
    expect(groupCalendarPath("g1", ["a", "b"])).toBe(
      "/api/account/groups/g1/calendar?eventId=a&eventId=b",
    );
  });
});

describe("buildEventsCalendar (DET-20)", () => {
  it("1 VCALENDAR / N VEVENT + UID stables", () => {
    const ics = buildEventsCalendar(
      [
        event({
          id: "e1",
          title: "A",
          startAt: "2026-10-12T18:00:00.000Z",
        }),
        event({
          id: "e2",
          title: "B",
          startAt: "2026-10-13T00:00:00+02:00",
          endAt: "2026-10-14T00:00:00+02:00",
          allDay: true,
        }),
      ],
      { now: NOW },
    );

    expect(ics.match(/BEGIN:VCALENDAR/g)?.length).toBe(1);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics.match(/END:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("UID:e1@detour");
    expect(ics).toContain("UID:e2@detour");
    expect(ics).toContain("DTSTART:20261012T180000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261013");
  });

  it("buildEventCalendar reste un wrapper mono-event", () => {
    const single = event({
      id: "openagenda:1",
      title: "Solo",
      startAt: "2026-10-12T18:00:00.000Z",
      endAt: "2026-10-12T20:00:00.000Z",
    });
    expect(buildEventCalendar(single, { now: NOW })).toBe(
      buildEventsCalendar([single], { now: NOW }),
    );
  });

  it("même event dans deux appels → même UID", () => {
    const a = buildEventsCalendar(
      [event({ id: "shared", title: "X", startAt: "2026-10-01T10:00:00.000Z" })],
      { now: NOW },
    );
    const b = buildEventsCalendar(
      [event({ id: "shared", title: "Y", startAt: "2026-11-01T10:00:00.000Z" })],
      { now: new Date("2026-09-17T00:00:00.000Z") },
    );
    expect(a).toContain("UID:shared@detour");
    expect(b).toContain("UID:shared@detour");
  });
});
