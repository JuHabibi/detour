import type { DetourEvent } from "@/domain/events/event";
import type { EventAvailabilityStatus } from "@/domain/events/event-availability";
import { matchMapadoCatalogEntry } from "@/infrastructure/ticketing/mapado/mapado-catalog-match";
import { parseMapadoEventAvailabilityStatus } from "@/infrastructure/ticketing/mapado/mapado-event-status";
import { parseMapadoPortalCatalog } from "@/infrastructure/ticketing/mapado/mapado-portal-catalog";
import {
  isMapadoTenantCandidate,
  type MapadoTenantConfig,
} from "@/infrastructure/ticketing/mapado/mapado-tenant";

export type MapadoEnrichmentResult = {
  tenantId: string;
  provider: MapadoTenantConfig["provider"];
  portalUrl: string;
  examinedCount: number;
  catalogSize: number;
  matchCount: number;
  availableCount: number;
  soldOutOnlineCount: number;
  soldOutCount: number;
  unknownCount: number;
  upsertedCount: number;
  portalFetchOk: boolean;
  matched: Array<{
    eventId: string;
    title: string;
    eventUrl: string;
    status: EventAvailabilityStatus | null;
  }>;
  errors: string[];
};

export type EnrichMapadoAvailabilityOptions = {
  tenant: MapadoTenantConfig;
  events: DetourEvent[];
  fetchImpl?: typeof fetch;
  dryRun?: boolean;
  now?: Date;
};

/**
 * Enrichissement best-effort disponibilité pour un tenant Mapado.
 * N’écrit jamais `unknown` ; un échec laisse l’ancienne ligne intacte.
 */
export async function enrichMapadoAvailability(
  options: EnrichMapadoAvailabilityOptions,
): Promise<MapadoEnrichmentResult> {
  const { tenant } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const candidates = options.events.filter((event) =>
    isMapadoTenantCandidate(tenant, event),
  );

  const result: MapadoEnrichmentResult = {
    tenantId: tenant.id,
    provider: tenant.provider,
    portalUrl: tenant.portalUrl,
    examinedCount: candidates.length,
    catalogSize: 0,
    matchCount: 0,
    availableCount: 0,
    soldOutOnlineCount: 0,
    soldOutCount: 0,
    unknownCount: 0,
    upsertedCount: 0,
    portalFetchOk: false,
    matched: [],
    errors: [],
  };

  if (candidates.length === 0) {
    return result;
  }

  let portalHtml: string;
  try {
    const response = await fetchImpl(tenant.portalUrl, {
      headers: { "user-agent": "DetourAvailabilityBot/1.0" },
      redirect: "follow",
    });
    if (!response.ok) {
      result.errors.push(`portal_http_${response.status}`);
      return result;
    }
    portalHtml = await response.text();
    result.portalFetchOk = true;
  } catch (error) {
    result.errors.push(
      `portal_fetch:${error instanceof Error ? error.message : "unknown"}`,
    );
    return result;
  }

  const catalog = parseMapadoPortalCatalog(portalHtml, tenant.portalUrl, {
    ignoredCatalogTitles: tenant.ignoredCatalogTitles,
  });
  result.catalogSize = catalog.length;
  if (catalog.length === 0) {
    result.errors.push("portal_catalog_empty");
    return result;
  }

  for (const event of candidates) {
    const match = matchMapadoCatalogEntry(event, catalog);
    if (!match) {
      result.unknownCount += 1;
      continue;
    }

    result.matchCount += 1;
    const eventUrl = match.eventUrl;
    let status: EventAvailabilityStatus | null = null;

    try {
      const response = await fetchImpl(eventUrl, {
        headers: { "user-agent": "DetourAvailabilityBot/1.0" },
        redirect: "follow",
      });
      if (!response.ok) {
        result.errors.push(`event_http_${response.status}:${event.id}`);
        result.unknownCount += 1;
        result.matched.push({
          eventId: event.id,
          title: event.title,
          eventUrl,
          status: null,
        });
        continue;
      }
      const html = await response.text();
      status = parseMapadoEventAvailabilityStatus(html);
    } catch (error) {
      result.errors.push(
        `event_fetch:${event.id}:${error instanceof Error ? error.message : "unknown"}`,
      );
      result.unknownCount += 1;
      result.matched.push({
        eventId: event.id,
        title: event.title,
        eventUrl,
        status: null,
      });
      continue;
    }

    result.matched.push({
      eventId: event.id,
      title: event.title,
      eventUrl,
      status,
    });

    if (!status || status === "unknown") {
      result.unknownCount += 1;
      continue;
    }

    if (status === "available") result.availableCount += 1;
    if (status === "sold_out_online") result.soldOutOnlineCount += 1;
    if (status === "sold_out") result.soldOutCount += 1;

    if (!dryRun) {
      try {
        const { upsertEventAvailability } = await import(
          "@/infrastructure/db/event-availability.repository"
        );
        await upsertEventAvailability({
          eventId: event.id,
          status,
          provider: tenant.provider,
          providerEventUrl: eventUrl,
          checkedAt: now,
        });
        result.upsertedCount += 1;
      } catch (error) {
        result.errors.push(
          `upsert:${event.id}:${error instanceof Error ? error.message : "unknown"}`,
        );
      }
    }
  }

  return result;
}
