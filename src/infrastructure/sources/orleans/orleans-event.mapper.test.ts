import { describe, expect, it } from "vitest";
import { ingestionFromPlainEvents } from "@/application/source-ingestion-stats";
import { mapOrleansEventToDetourEvent } from "@/infrastructure/sources/orleans/orleans-event.mapper";
import type { OrleansRawEvent } from "@/infrastructure/sources/orleans/orleans-event.types";
import { mapSaranIcalEventToDetourEvent } from "@/infrastructure/sources/saran/saran-ical.mapper";
import type { SaranIcalEvent } from "@/infrastructure/sources/saran/saran-ical.types";

function rawOrleans(uid: string): OrleansRawEvent {
  return {
    uid,
    title_fr: "Concert test",
    description_fr: "Desc",
    image: null,
    firstdate_begin: "2026-11-12T20:00:00+02:00",
    firstdate_end: null,
    location_name: "Salle",
    location_city: "Orléans",
    location_coordinates: null,
    categorie_principale: "Concert",
    conditions_fr: null,
    originagenda_title: "Agenda Orléans",
    canonicalurl: "https://openagenda.com/example",
    registration: null,
    statut_evenement: null,
  };
}

function rawSaran(uid: string): SaranIcalEvent {
  return {
    uid,
    summary: "Événement Saran",
    description: null,
    location: "Mairie",
    url: null,
    dtStart: {
      kind: "date-time",
      year: 2026,
      month: 11,
      day: 12,
      hour: 20,
      minute: 0,
      second: 0,
      timeZone: "Europe/Paris",
    },
    dtEnd: null,
    lastModified: null,
  };
}

describe("mapOrleansEventToDetourEvent IDs namespacés", () => {
  it("préfixe l’ID OpenAgenda : openagenda:<externalId>", () => {
    const event = mapOrleansEventToDetourEvent(rawOrleans("7937057"));
    expect(event).not.toBeNull();
    expect(event!.id).toBe("openagenda:7937057");
  });

  it("même externalId brut Orléans vs Saran → DetourEvent.id distincts", () => {
    const orleans = mapOrleansEventToDetourEvent(rawOrleans("shared-uid"));
    const saran = mapSaranIcalEventToDetourEvent(rawSaran("shared-uid"));

    expect(orleans).not.toBeNull();
    expect(saran).not.toBeNull();
    expect(orleans!.id).toBe("openagenda:shared-uid");
    expect(saran!.id).toBe("saran:shared-uid");
    expect(orleans!.id).not.toBe(saran!.id);
  });

  it("provenance adapterByEventId suit l’ID préfixé", () => {
    const event = mapOrleansEventToDetourEvent(rawOrleans("42"))!;
    const ingestion = ingestionFromPlainEvents(
      [event],
      "orleans",
      "Orléans / OpenAgenda",
    );

    expect(ingestion.adapterByEventId.get("openagenda:42")).toBe("orleans");
    expect(ingestion.adapterByEventId.has("42")).toBe(false);
  });
});
