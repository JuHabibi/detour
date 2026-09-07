import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EVENT_AVAILABILITY_MAX_AGE_MS,
  isRadarEligibleAvailability,
  resolveAvailabilityBadge,
  resolveFreshAvailabilityStatus,
} from "@/domain/events/event-availability";
import { matchMapadoCatalogEntry } from "@/infrastructure/ticketing/mapado/mapado-catalog-match";
import { MAPADO_CHECY_TENANT } from "@/infrastructure/ticketing/mapado/mapado-config";
import { parseMapadoPortalCatalog } from "@/infrastructure/ticketing/mapado/mapado-portal-catalog";
import {
  mapMapadoAvailabilityStatus,
  parseMapadoEventAvailabilityStatus,
} from "@/infrastructure/ticketing/mapado/mapado-event-status";
import { titlesMatchConservatively } from "@/infrastructure/ticketing/mapado/mapado-title-normalize";
import { rankDetourHighlightCandidates } from "@/domain/editorial/select-detour-highlights";
import type { DetourEvent } from "@/domain/events/event";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../infrastructure/ticketing/mapado/fixtures",
);

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

function baseEvent(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title" | "startAt">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    endAt: null,
    venue: "Espace George Sand",
    city: "Chécy",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda de  Chécy",
    sourceUrl: null,
    registrationUrl: "https://www.checy.fr/billetterie/",
    relevance: "culture",
    ...partial,
  };
}

const PORTAL_URL = MAPADO_CHECY_TENANT.portalUrl;
const catalogParseOptions = {
  ignoredCatalogTitles: MAPADO_CHECY_TENANT.ignoredCatalogTitles,
};

describe("Mapado portal catalog", () => {
  it("parse les cartes titre / jour / path", () => {
    const catalog = parseMapadoPortalCatalog(
      fixture("portal-checy-sample.html"),
      PORTAL_URL,
      catalogParseOptions,
    );
    expect(catalog.length).toBeGreaterThanOrEqual(3);
    const bourgeois = catalog.find((e) => e.path.includes("778760"));
    expect(bourgeois?.title).toMatch(/BOURGEOIS/i);
    expect(bourgeois?.day).toBe("2027-01-20");
    expect(bourgeois?.eventUrl).toBe(
      `${PORTAL_URL}event/778760-le-bourgeois-gentilhomme`,
    );
    const chameau = catalog.find((e) => e.path.includes("780188"));
    expect(chameau?.day).toBe("2026-12-06");
  });
});

describe("Mapado matching", () => {
  const catalog = parseMapadoPortalCatalog(
    fixture("portal-checy-sample.html"),
    PORTAL_URL,
    catalogParseOptions,
  );

  it("Bourgeois → match unique", () => {
    const hit = matchMapadoCatalogEntry(
      {
        title: "LE BOURGEOIS GENTILHOMME - SAISON CULTURELLE 26/27",
        startAt: "2027-01-20T19:30:00.000Z",
      },
      catalog,
    );
    expect(hit?.path).toBe("/event/778760-le-bourgeois-gentilhomme");
  });

  it("À dos de chameau → match unique", () => {
    const hit = matchMapadoCatalogEntry(
      {
        title: "À dos de chameau - SAISON CULTURELLE 26/27",
        startAt: "2026-12-06T16:00:00.000Z",
      },
      catalog,
    );
    expect(hit?.path).toBe("/event/780188-a-dos-de-chameau");
  });

  it("& ↔ et", () => {
    expect(
      titlesMatchConservatively("ROMÉO & JULIETTE", "ROMÉO ET JULIETTE"),
    ).toBe(true);
    const hit = matchMapadoCatalogEntry(
      {
        title: "ROMÉO & JULIETTE - SAISON CULTURELLE 26/27",
        startAt: "2027-05-13T18:00:00.000Z",
      },
      catalog,
    );
    expect(hit?.path).toBe("/event/778816-romeo-et-juliette");
  });

  it("date différente → aucun match", () => {
    const hit = matchMapadoCatalogEntry(
      {
        title: "LE BOURGEOIS GENTILHOMME - SAISON CULTURELLE 26/27",
        startAt: "2027-01-21T19:30:00.000Z",
      },
      catalog,
    );
    expect(hit).toBeNull();
  });

  it("ambiguïté → aucun match", () => {
    const hit = matchMapadoCatalogEntry(
      {
        title: "SPECTACLE DOUBLE",
        startAt: "2027-06-01T18:00:00.000Z",
      },
      catalog,
    );
    expect(hit).toBeNull();
  });
});

describe("Mapado event status parse", () => {
  it("onSale → available", () => {
    expect(parseMapadoEventAvailabilityStatus(fixture("event-onsale.html"))).toBe(
      "available",
    );
  });

  it("soldOutOnline → sold_out_online", () => {
    expect(
      parseMapadoEventAvailabilityStatus(fixture("event-soldout-online.html")),
    ).toBe("sold_out_online");
  });

  it("soldOut → sold_out", () => {
    expect(
      parseMapadoEventAvailabilityStatus(fixture("event-soldout.html")),
    ).toBe("sold_out");
  });

  it("HTML inattendu → null (pas inventé)", () => {
    expect(
      parseMapadoEventAvailabilityStatus(fixture("event-unexpected.html")),
    ).toBeNull();
    expect(mapMapadoAvailabilityStatus("weird")).toBeNull();
  });
});

describe("availability freshness + Radar filter", () => {
  it("sold_out_online frais → exclu Radar", () => {
    expect(isRadarEligibleAvailability("sold_out_online")).toBe(false);
    expect(isRadarEligibleAvailability("sold_out")).toBe(false);
    expect(isRadarEligibleAvailability("available")).toBe(true);
    expect(isRadarEligibleAvailability("unknown")).toBe(true);
  });

  it("statut stale sold_out_online → unknown → Radar éligible", () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const stale = new Date(
      now.getTime() - EVENT_AVAILABILITY_MAX_AGE_MS - 60_000,
    );
    const resolved = resolveFreshAvailabilityStatus({
      status: "sold_out_online",
      checkedAt: stale,
      now,
    });
    expect(resolved).toBe("unknown");
    expect(isRadarEligibleAvailability(resolved)).toBe(true);
  });

  it("filtre ranking Radar ignore sold_out_online frais", () => {
    const nowIso = new Date().toISOString();
    const events = [
      baseEvent({
        id: "openagenda:1",
        title: "Spectacle A - SAISON CULTURELLE 26/27",
        startAt: "2026-12-01T19:00:00.000Z",
        description: "Un spectacle de théâtre contemporain intéressant.",
        registrationUrl: "https://example.com/a",
        availabilityStatus: "sold_out_online",
        availabilityCheckedAt: nowIso,
      }),
      baseEvent({
        id: "openagenda:2",
        title: "Spectacle B - SAISON CULTURELLE 26/27",
        startAt: "2026-12-02T19:00:00.000Z",
        description: "Un concert de musique live avec artistes locaux.",
        registrationUrl: "https://example.com/b",
        availabilityStatus: "available",
        availabilityCheckedAt: nowIso,
      }),
    ];
    const eligible = events.filter((e) =>
      isRadarEligibleAvailability(e.availabilityStatus),
    );
    const ranked = rankDetourHighlightCandidates(eligible);
    expect(ranked.map((h) => h.event.id)).not.toContain("openagenda:1");
    expect(ranked.map((h) => h.event.id)).toContain("openagenda:2");
  });
});

describe("Explorer availability badge", () => {
  it("conserve l’événement sold_out_online avec badge Complet en ligne", () => {
    expect(resolveAvailabilityBadge("sold_out_online")).toBe("Complet en ligne");
    expect(resolveAvailabilityBadge("sold_out")).toBe("Complet");
    expect(resolveAvailabilityBadge("available")).toBeNull();
    expect(resolveAvailabilityBadge("unknown")).toBeNull();

    const item = mapDetourEventToEventItem(
      baseEvent({
        id: "openagenda:59662176",
        title: "LE BOURGEOIS GENTILHOMME - SAISON CULTURELLE 26/27",
        startAt: "2027-01-20T19:30:00.000Z",
        availabilityStatus: "sold_out_online",
        bookingUrl:
          "https://billetterie-checy.mapado.com/event/778760-le-bourgeois-gentilhomme",
      }),
    );
    expect(item.availabilityBadge).toBe("Complet en ligne");
    expect(item.registrationUrl).toContain("/event/778760-");
  });
});
