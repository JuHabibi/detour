import { describe, expect, it } from "vitest";
import type { PublicEventPageData } from "@/application/events/get-public-event-page";
import type { EventItem } from "@/data/types";
import {
  buildEventJsonLd,
  exclusiveEndAtToInclusiveParisDateKey,
  formatEventJsonLdEndDate,
  serializeJsonLdScript,
} from "@/features/event-page/build-event-json-ld";

function item(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "openagenda:1",
    title: "Concert test",
    category: "Musique",
    genre: "",
    venue: "Scène nationale",
    city: "Orléans",
    date: "2026-11-10",
    dateLabel: "Mardi 10 novembre",
    description: "Une soirée",
    ...overrides,
  };
}

function data(
  overrides: Partial<PublicEventPageData> = {},
): PublicEventPageData {
  return {
    eventId: "openagenda:1",
    item: item(),
    startAt: "2026-11-10T19:00:00+01:00",
    endAt: "2026-11-10T21:30:00+01:00",
    isEnded: false,
    ...overrides,
  };
}

describe("buildEventJsonLd", () => {
  it("construit un Event pour une fiche éligible", () => {
    expect(buildEventJsonLd(data())).toEqual({
      "@context": "https://schema.org",
      "@type": "Event",
      "@id": "https://detour.website/evenements/openagenda%3A1#event",
      url: "https://detour.website/evenements/openagenda%3A1",
      name: "Concert test",
      description: "Une soirée",
      startDate: "2026-11-10T19:00:00+01:00",
      endDate: "2026-11-10T21:30:00+01:00",
      location: {
        "@type": "Place",
        name: "Scène nationale",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Orléans",
        },
      },
    });
  });

  it("omet le JSON-LD si terminé, sans titre, sans date ou sans lieu", () => {
    expect(buildEventJsonLd(data({ isEnded: true }))).toBeNull();
    expect(
      buildEventJsonLd(data({ item: item({ title: "  " }) })),
    ).toBeNull();
    expect(
      buildEventJsonLd(
        data({ startAt: "not-a-date", endAt: null, item: item() }),
      ),
    ).toBeNull();
    expect(
      buildEventJsonLd(
        data({ item: item({ venue: null, city: null }) }),
      ),
    ).toBeNull();
  });

  it("n’invente ni offers, ni organizer, ni image placeholder", () => {
    const jsonLd = buildEventJsonLd(
      data({
        item: item({
          image: "/images/placeholders/detour-placeholder-concert.webp",
          price: undefined,
          source: "OpenAgenda",
        }),
        endAt: null,
      }),
    );
    expect(jsonLd).not.toBeNull();
    expect(jsonLd).not.toHaveProperty("offers");
    expect(jsonLd).not.toHaveProperty("organizer");
    expect(jsonLd).not.toHaveProperty("eventStatus");
    expect(jsonLd).not.toHaveProperty("image");
    expect(jsonLd).not.toHaveProperty("endDate");
  });

  it("accepte une localisation partielle (ville seule) et une vraie image", () => {
    const jsonLd = buildEventJsonLd(
      data({
        item: item({
          venue: null,
          city: "Orléans",
          image: "https://img.openagenda.com/poster.jpg",
        }),
      }),
    );
    expect(jsonLd?.location).toEqual({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Orléans",
      },
    });
    expect(jsonLd?.image).toEqual(["https://img.openagenda.com/poster.jpg"]);
  });

  it("encode les ids à caractères spéciaux dans url / @id", () => {
    const id = "saran:calendar.12529.field_date_debut.0@www.mairie-saran.fr";
    const jsonLd = buildEventJsonLd(
      data({
        eventId: id,
        item: item({ id }),
      }),
    );
    expect(jsonLd?.url).toBe(
      "https://detour.website/evenements/saran%3Acalendar.12529.field_date_debut.0%40www.mairie-saran.fr",
    );
    expect(jsonLd?.["@id"]).toBe(`${jsonLd?.url}#event`);
  });
});

describe("all-day JSON-LD dates", () => {
  it("journée unique : endAt exclusif → startDate = endDate inclus", () => {
    const page = data({
      startAt: "2026-11-05T00:00:00+01:00",
      endAt: "2026-11-06T00:00:00+01:00",
      item: item({ allDay: true }),
    });
    const jsonLd = buildEventJsonLd(page);
    expect(jsonLd?.startDate).toBe("2026-11-05");
    expect(jsonLd?.endDate).toBe("2026-11-05");
    expect(exclusiveEndAtToInclusiveParisDateKey(page.endAt!)).toBe(
      "2026-11-05",
    );
  });

  it("plage multi-jours : dernier jour inclus = veille de endAt", () => {
    const page = data({
      startAt: "2026-11-05T00:00:00+01:00",
      endAt: "2026-11-08T00:00:00+01:00",
      item: item({ allDay: true }),
    });
    expect(buildEventJsonLd(page)).toMatchObject({
      startDate: "2026-11-05",
      endDate: "2026-11-07",
    });
  });

  it("conversion autour d’un changement d’heure (CEST → CET)", () => {
    // Fin d’heure d’été 2026 : 25 oct. 03:00 CEST → 02:00 CET.
    // All-day 24 oct. → endAt exclusif = 25 oct. 00:00 Paris (CEST, UTC+02).
    const endAt = "2026-10-25T00:00:00+02:00";
    expect(exclusiveEndAtToInclusiveParisDateKey(endAt)).toBe("2026-10-24");
    expect(
      formatEventJsonLdEndDate({
        startAt: "2026-10-24T00:00:00+02:00",
        endAt,
        item: item({ allDay: true }),
      }),
    ).toBe("2026-10-24");
  });
});

describe("serializeJsonLdScript", () => {
  it("échappe < pour ne pas fermer le script", () => {
    const raw = serializeJsonLdScript({
      description: "Avant </script><script>alert(1)</script> après",
    });
    expect(raw).toContain("\\u003c/script>");
    expect(raw).not.toContain("</script>");
  });
});
