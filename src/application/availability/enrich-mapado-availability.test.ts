import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { enrichMapadoAvailability } from "@/application/availability/enrich-mapado-availability";
import type { DetourEvent } from "@/domain/events/event";
import type { MapadoTenantConfig } from "@/infrastructure/ticketing/mapado/mapado-tenant";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../infrastructure/ticketing/mapado/fixtures",
);

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

const tenant: MapadoTenantConfig = {
  id: "checy",
  provider: "mapado",
  portalUrl: "https://billetterie-checy.mapado.com/",
  cityHints: ["checy"],
  registrationHints: [
    "billetterie-checy.mapado.com",
    "checy.fr/billetterie",
  ],
  ignoredCatalogTitles: ["CHÉCY"],
};

const BOURGEOIS_ID = "openagenda:59662176";
const BOURGEOIS_URL =
  "https://billetterie-checy.mapado.com/event/778760-le-bourgeois-gentilhomme";

function bourgeoisEvent(): DetourEvent {
  return {
    id: BOURGEOIS_ID,
    title: "LE BOURGEOIS GENTILHOMME - SAISON CULTURELLE 26/27",
    description: null,
    imageUrl: null,
    startAt: "2027-01-20T19:30:00.000Z",
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
  };
}

function okHtml(html: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => html,
  } as Response;
}

describe("enrichMapadoAvailability", () => {
  it("catalogue mpd-card → match Bourgeois + sold_out_online", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tenant.portalUrl) {
        return okHtml(fixture("portal-checy-mpd-card.html"));
      }
      if (url.includes("/event/778760-")) {
        return okHtml(fixture("event-soldout-online.html"));
      }
      return okHtml(fixture("event-onsale.html"));
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [bourgeoisEvent()],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
      knownProviderEventUrls: new Map(),
    });

    expect(result.portalFetchOk).toBe(true);
    expect(result.catalogSize).toBeGreaterThanOrEqual(3);
    expect(result.matchCount).toBe(1);
    expect(result.soldOutOnlineCount).toBe(1);
    expect(result.matched[0]).toMatchObject({
      eventId: BOURGEOIS_ID,
      status: "sold_out_online",
      source: "catalog",
    });
    expect(result.matched[0]?.eventUrl).toContain("/event/778760-");
  });

  it("portail inaccessible + URL connue → rafraîchit quand même", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tenant.portalUrl) {
        throw new Error("portal down");
      }
      if (url === BOURGEOIS_URL) {
        return okHtml(fixture("event-soldout-online.html"));
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [bourgeoisEvent()],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
      knownProviderEventUrls: new Map([[BOURGEOIS_ID, BOURGEOIS_URL]]),
    });

    expect(result.portalFetchOk).toBe(false);
    expect(result.errors.some((e) => e.startsWith("portal_fetch:"))).toBe(true);
    expect(result.matched[0]).toMatchObject({
      eventId: BOURGEOIS_ID,
      status: "sold_out_online",
      source: "known_url",
    });
  });

  it("catalogue vide + URL connue → rafraîchit sans inventer unknown", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tenant.portalUrl) {
        return okHtml("<html><body>no cards</body></html>");
      }
      if (url === BOURGEOIS_URL) {
        return okHtml(fixture("event-soldout-online.html"));
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [bourgeoisEvent()],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
      knownProviderEventUrls: new Map([[BOURGEOIS_ID, BOURGEOIS_URL]]),
    });

    expect(result.errors).toContain("portal_catalog_empty");
    expect(result.knownUrlCount).toBe(1);
    expect(result.matchCount).toBe(1);
    expect(result.soldOutOnlineCount).toBe(1);
    expect(result.matched[0]).toMatchObject({
      eventId: BOURGEOIS_ID,
      status: "sold_out_online",
      source: "known_url",
      eventUrl: BOURGEOIS_URL,
    });
    expect(result.unknownCount).toBe(0);
  });

  it("URL connue prioritaire même si catalogue disponible", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tenant.portalUrl) {
        return okHtml(fixture("portal-checy-mpd-card.html"));
      }
      if (url === BOURGEOIS_URL) {
        return okHtml(fixture("event-soldout-online.html"));
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [bourgeoisEvent()],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
      knownProviderEventUrls: new Map([[BOURGEOIS_ID, BOURGEOIS_URL]]),
    });

    expect(result.matched[0]?.source).toBe("known_url");
    expect(fetchImpl).toHaveBeenCalledWith(
      BOURGEOIS_URL,
      expect.anything(),
    );
  });

  it("échec parse fiche → pas de statut inventé (unknownCount, pas sold_out*)", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tenant.portalUrl) {
        return okHtml("<html></html>");
      }
      return okHtml(fixture("event-unexpected.html"));
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [bourgeoisEvent()],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
      knownProviderEventUrls: new Map([[BOURGEOIS_ID, BOURGEOIS_URL]]),
    });

    expect(result.matched[0]?.status).toBeNull();
    expect(result.soldOutOnlineCount).toBe(0);
    expect(result.soldOutCount).toBe(0);
    expect(result.availableCount).toBe(0);
    expect(result.unknownCount).toBe(1);
    expect(result.upsertedCount).toBe(0);
  });

  it("plafond de fetches → event_fetch_cap, sans inventer de statut", async () => {
    const other: DetourEvent = {
      ...bourgeoisEvent(),
      id: "openagenda:other",
      title: "A DOS DE CHAMEAU - SAISON CULTURELLE 26/27",
      startAt: "2026-12-06T16:00:00.000Z",
    };
    const otherUrl =
      "https://billetterie-checy.mapado.com/event/780188-a-dos-de-chameau";

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tenant.portalUrl) {
        return okHtml("<html></html>");
      }
      return okHtml(fixture("event-onsale.html"));
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [bourgeoisEvent(), other],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
      maxEventFetches: 1,
      knownProviderEventUrls: new Map([
        [BOURGEOIS_ID, BOURGEOIS_URL],
        [other.id, otherUrl],
      ]),
    });

    expect(result.errors).toContain("event_fetch_cap");
    expect(result.matchCount).toBe(1);
    expect(result.unknownCount).toBe(1);
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes("/event/")).length).toBe(
      1,
    );
  });

  it("conserve soldOut vs soldOutOnline", async () => {
    const soldOutEvent: DetourEvent = {
      ...bourgeoisEvent(),
      id: "openagenda:soldout",
    };
    const soldOutUrl =
      "https://billetterie-checy.mapado.com/event/999-soldout";

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === tenant.portalUrl) return okHtml("<html></html>");
      if (url === BOURGEOIS_URL) return okHtml(fixture("event-soldout-online.html"));
      if (url === soldOutUrl) return okHtml(fixture("event-soldout.html"));
      throw new Error(`unexpected ${url}`);
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [bourgeoisEvent(), soldOutEvent],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
      knownProviderEventUrls: new Map([
        [BOURGEOIS_ID, BOURGEOIS_URL],
        [soldOutEvent.id, soldOutUrl],
      ]),
    });

    expect(result.soldOutOnlineCount).toBe(1);
    expect(result.soldOutCount).toBe(1);
    expect(
      result.matched.find((m) => m.eventId === BOURGEOIS_ID)?.status,
    ).toBe("sold_out_online");
    expect(
      result.matched.find((m) => m.eventId === soldOutEvent.id)?.status,
    ).toBe("sold_out");
  });
});
