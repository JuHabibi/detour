import { describe, expect, it, vi } from "vitest";
import { enrichMapadoAvailability } from "@/application/availability/enrich-mapado-availability";
import {
  hangingFetch,
  headersThenHangingBody,
  rejectWhenAborted,
} from "@/infrastructure/http/http-timeout.test-helpers";
import type { DetourEvent } from "@/domain/events/event";
import type { MapadoTenantConfig } from "@/infrastructure/ticketing/mapado/mapado-tenant";

const SHORT_TIMEOUT_MS = 40;

const tenant: MapadoTenantConfig = {
  id: "checy-test",
  provider: "mapado",
  portalUrl: "https://billetterie-checy.mapado.com/",
  cityHints: ["checy"],
  registrationHints: ["billetterie-checy.mapado.com"],
  ignoredCatalogTitles: [],
};

function eventStub(id: string): DetourEvent {
  return {
    id,
    title: "Concert test",
    description: null,
    imageUrl: null,
    startAt: "2026-10-15T20:00:00+02:00",
    endAt: null,
    venue: null,
    city: "Checy",
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: "https://billetterie-checy.mapado.com/event/1",
  };
}

const PORTAL_HTML = `
<a class="TicketingItem__Container" href="/event/42-concert-test">
  <span>Mer. 15 octobre 2026</span>
  <h3>Concert test</h3>
</a>
`;

describe("enrichMapadoAvailability HTTP timeout", () => {
  it("portail bloqué → erreur existante, pas de succès portail", async () => {
    const result = await enrichMapadoAvailability({
      tenant,
      events: [eventStub("e1")],
      fetchImpl: hangingFetch as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
      dryRun: true,
    });

    expect(result.portalFetchOk).toBe(false);
    expect(result.errors.some((e) => e.startsWith("portal_fetch:"))).toBe(true);
    expect(result.upsertedCount).toBe(0);
  });

  it("fiche bloquée → poursuit, best-effort, sans upsert", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === tenant.portalUrl || url.endsWith("/")) {
        return {
          ok: true,
          status: 200,
          text: async () => PORTAL_HTML,
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: () => rejectWhenAborted(init?.signal),
      } as unknown as Response;
    });

    const result = await enrichMapadoAvailability({
      tenant,
      events: [eventStub("e1"), eventStub("e2")],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
      dryRun: true,
    });

    expect(result.portalFetchOk).toBe(true);
    expect(result.errors.some((e) => e.startsWith("event_fetch:"))).toBe(true);
    expect(result.upsertedCount).toBe(0);
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it("corps portail bloqué après headers → portal_fetch", async () => {
    const result = await enrichMapadoAvailability({
      tenant,
      events: [eventStub("e1")],
      fetchImpl: headersThenHangingBody as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
      dryRun: true,
    });

    expect(result.portalFetchOk).toBe(false);
    expect(result.errors[0]).toMatch(/^portal_fetch:/);
  });
});
