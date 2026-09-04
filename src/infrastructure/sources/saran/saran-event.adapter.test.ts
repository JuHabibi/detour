import { describe, expect, it, vi } from "vitest";
import { CompositeEventSourceAdapter } from "@/infrastructure/composite-event-source.adapter";
import {
  SARAN_CITY,
  SARAN_SOURCE_NAME,
  mapSaranIcalEventToDetourEvent,
  saranEventIntersectsWindow,
} from "@/infrastructure/sources/saran/saran-ical.mapper";
import {
  parseSaranIcal,
  unfoldIcalLines,
  unescapeIcalText,
} from "@/infrastructure/sources/saran/saran-ical.parser";
import { SaranEventAdapter } from "@/infrastructure/sources/saran/saran-event.adapter";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { DetourEvent } from "@/domain/event";

const STANDARD_VEVENT = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:calendar.12529.field_date_debut.0@www.mairie-saran.fr
DESCRIPTION:Renseignements 06 30 65 54 84\\n\\nMail : test@example.com
DTSTART;TZID=Europe/Paris:20260905T080000
DTEND;TZID=Europe/Paris:20260905T190000
LOCATION:Institut des Cent Arpents
SUMMARY:Formation psc1
URL;TYPE=URI:https://www.mairie-saran.fr/evenement/formation-psc1
END:VEVENT
END:VCALENDAR`;

const ALL_DAY_VEVENT = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:all-day-1@www.mairie-saran.fr
SUMMARY:Journée portes ouvertes
DTSTART;VALUE=DATE:20260920
DTEND;VALUE=DATE:20260921
END:VEVENT
END:VCALENDAR`;

const FOLDED_VEVENT = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:folded-1@www.mairie-saran.fr
SUMMARY:La médiathèque en vadrouille
DESCRIPTION:Les bibliothécaires sortent de leurs rayons et s’installent en 
 plein air ! Pour venir bouquiner ou lire\\, tranquillou\\, les doigts de pie
 ds dans l’herbe !\\n\\nFamilial
DTSTART;TZID=Europe/Paris:20260804T163000
DTEND;TZID=Europe/Paris:20260804T180000
LOCATION:Parc du Château de l'Étang
URL;TYPE=URI:https://www.mairie-saran.fr/evenement/la-mediatheque-en-vadrou
 ille-23
END:VEVENT
END:VCALENDAR`;

const NO_LOCATION_VEVENT = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:no-loc@www.mairie-saran.fr
SUMMARY:Sans lieu
DTSTART;TZID=Europe/Paris:20261010T100000
DTEND;TZID=Europe/Paris:20261010T110000
END:VEVENT
END:VCALENDAR`;

describe("saran ical parser", () => {
  it("parse un VEVENT standard Europe/Paris", () => {
    const events = parseSaranIcal(STANDARD_VEVENT);
    expect(events).toHaveLength(1);
    expect(events[0]?.uid).toBe(
      "calendar.12529.field_date_debut.0@www.mairie-saran.fr",
    );
    expect(events[0]?.summary).toBe("Formation psc1");
    expect(events[0]?.dtStart).toMatchObject({
      kind: "date-time",
      year: 2026,
      month: 9,
      day: 5,
      hour: 8,
      timeZone: "Europe/Paris",
    });
  });

  it("parse un événement all-day VALUE=DATE", () => {
    const events = parseSaranIcal(ALL_DAY_VEVENT);
    expect(events[0]?.dtStart).toEqual({
      kind: "date",
      year: 2026,
      month: 9,
      day: 20,
      timeZone: "Europe/Paris",
    });
    expect(events[0]?.dtEnd).toEqual({
      kind: "date",
      year: 2026,
      month: 9,
      day: 21,
      timeZone: "Europe/Paris",
    });
  });

  it("déplie les folded lines et unescape DESCRIPTION", () => {
    const unfolded = unfoldIcalLines(FOLDED_VEVENT).join("\n");
    expect(unfolded).toContain("doigts de pieds");
    expect(unfolded).toContain("la-mediatheque-en-vadrouille-23");

    const events = parseSaranIcal(FOLDED_VEVENT);
    expect(events[0]?.description).toContain("lire, tranquillou");
    expect(events[0]?.description).toContain("\n");
    expect(events[0]?.url).toBe(
      "https://www.mairie-saran.fr/evenement/la-mediatheque-en-vadrouille-23",
    );
  });

  it("unescape iCal basique", () => {
    expect(unescapeIcalText("a\\,b\\;c\\\\d\\n")).toBe("a,b;c\\d\n");
  });

  it("accepte un événement sans LOCATION", () => {
    const events = parseSaranIcal(NO_LOCATION_VEVENT);
    expect(events[0]?.location).toBeNull();
  });
});

describe("saran ical mapper", () => {
  it("mappe UID, source, city et ISO Paris", () => {
    const [raw] = parseSaranIcal(STANDARD_VEVENT);
    const event = mapSaranIcalEventToDetourEvent(raw!);
    expect(event?.id).toBe(
      "saran:calendar.12529.field_date_debut.0@www.mairie-saran.fr",
    );
    expect(event?.source).toBe(SARAN_SOURCE_NAME);
    expect(event?.city).toBe(SARAN_CITY);
    expect(event?.venue).toBe("Institut des Cent Arpents");
    expect(event?.startAt).toBe("2026-09-05T08:00:00+02:00");
    expect(event?.endAt).toBe("2026-09-05T19:00:00+02:00");
    expect(event?.latitude).toBeNull();
    expect(event?.category).toBeNull();
    expect(event?.registrationUrl).toBeNull();
  });

  it("all-day : DTEND exclusif en ISO", () => {
    const [raw] = parseSaranIcal(ALL_DAY_VEVENT);
    const event = mapSaranIcalEventToDetourEvent(raw!);
    expect(event?.startAt).toBe("2026-09-20T00:00:00+02:00");
    expect(event?.endAt).toBe("2026-09-21T00:00:00+02:00");
  });

  it("filtre from/to par intersection", () => {
    const [raw] = parseSaranIcal(STANDARD_VEVENT);
    const event = mapSaranIcalEventToDetourEvent(raw!)!;
    expect(
      saranEventIntersectsWindow(
        event,
        new Date("2026-09-01T00:00:00+02:00"),
        new Date("2026-09-30T23:59:59+02:00"),
      ),
    ).toBe(true);
    expect(
      saranEventIntersectsWindow(
        event,
        new Date("2026-10-01T00:00:00+02:00"),
        new Date("2026-10-31T23:59:59+02:00"),
      ),
    ).toBe(false);
  });
});

describe("SaranEventAdapter", () => {
  it("fetch + parse + filtre fenêtre (mock réseau)", async () => {
    const fetchSimple = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => STANDARD_VEVENT,
    });

    const adapter = new SaranEventAdapter({
      fetchImpl: fetchSimple as unknown as typeof fetch,
    });

    const inWindow = await adapter.fetchUpcomingEvents({
      from: new Date("2026-09-01T00:00:00+02:00"),
      to: new Date("2026-09-30T23:59:59+02:00"),
    });
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0]?.source).toBe(SARAN_SOURCE_NAME);

    const outWindow = await adapter.fetchUpcomingEvents({
      from: new Date("2026-11-01T00:00:00+01:00"),
      to: new Date("2026-11-30T23:59:59+01:00"),
    });
    expect(outWindow).toHaveLength(0);
    expect(fetchSimple).toHaveBeenCalled();
  });
});

describe("CompositeEventSourceAdapter", () => {
  it("agrège Orleans + Saran (mocks)", async () => {
    const orleans: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [
        eventStub("orleans-1", "Agenda Orléans"),
      ],
    };
    const saran: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [
        eventStub("saran:1", SARAN_SOURCE_NAME),
      ],
    };

    const composite = new CompositeEventSourceAdapter([
      { name: "orleans", label: "Orléans / OpenAgenda", adapter: orleans },
      { name: "saran", label: "Ville de Saran", adapter: saran },
    ]);

    const events = await composite.fetchUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(events.map((item) => item.id)).toEqual(["orleans-1", "saran:1"]);
  });

  it("continue si une source échoue", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [eventStub("ok", "OK")],
    };
    const failing: EventSourceAdapter = {
      fetchUpcomingEvents: async () => {
        throw new Error("down");
      },
    };

    const composite = new CompositeEventSourceAdapter([
      { name: "saran", label: "Ville de Saran", adapter: failing },
      { name: "orleans", label: "Orléans / OpenAgenda", adapter: ok },
    ]);

    const events = await composite.fetchUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("ok");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

function eventStub(id: string, source: string): DetourEvent {
  return {
    id,
    title: id,
    description: null,
    imageUrl: null,
    startAt: "2026-09-12T20:00:00+02:00",
    endAt: null,
    venue: null,
    city: "Saran",
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source,
    sourceUrl: null,
    registrationUrl: null,
  };
}
