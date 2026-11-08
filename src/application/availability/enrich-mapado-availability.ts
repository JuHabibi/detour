import type { DetourEvent } from "@/domain/events/event";
import type { EventAvailabilityStatus } from "@/domain/events/event-availability";
import {
  SOURCE_HTTP_TIMEOUT_MS,
  withHttpTimeout,
} from "@/infrastructure/http/http-timeout";
import { matchMapadoCatalogEntry } from "@/infrastructure/ticketing/mapado/mapado-catalog-match";
import { parseMapadoEventAvailabilityStatus } from "@/infrastructure/ticketing/mapado/mapado-event-status";
import { parseMapadoPortalCatalog } from "@/infrastructure/ticketing/mapado/mapado-portal-catalog";
import {
  isMapadoTenantCandidate,
  type MapadoTenantConfig,
} from "@/infrastructure/ticketing/mapado/mapado-tenant";

/** Plafond de fiches événement fetchées par run (catalogue + URLs connues). */
export const MAPADO_ENRICHMENT_MAX_EVENT_FETCHES = 50;

export type MapadoEnrichmentResult = {
  tenantId: string;
  provider: MapadoTenantConfig["provider"];
  portalUrl: string;
  examinedCount: number;
  catalogSize: number;
  knownUrlCount: number;
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
    source: "known_url" | "catalog";
  }>;
  errors: string[];
};

export type EnrichMapadoAvailabilityOptions = {
  tenant: MapadoTenantConfig;
  events: DetourEvent[];
  fetchImpl?: typeof fetch;
  /** Délai par requête portail / fiche (fetch + text). Défaut 15s. */
  httpTimeoutMs?: number;
  dryRun?: boolean;
  now?: Date;
  /**
   * Deep-links Mapado déjà connus (eventId → URL).
   * Si omis, chargés depuis `event_availability` pour les candidats.
   */
  knownProviderEventUrls?: ReadonlyMap<string, string>;
  /** Plafond de fetches fiche. Défaut `MAPADO_ENRICHMENT_MAX_EVENT_FETCHES`. */
  maxEventFetches?: number;
};

/**
 * Enrichissement best-effort disponibilité pour un tenant Mapado.
 * N’écrit jamais `unknown` ; un échec laisse l’ancienne ligne intacte.
 * Privilégie les `provider_event_url` déjà connus, avec repli catalogue portail.
 */
export async function enrichMapadoAvailability(
  options: EnrichMapadoAvailabilityOptions,
): Promise<MapadoEnrichmentResult> {
  const { tenant } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const httpTimeoutMs = options.httpTimeoutMs ?? SOURCE_HTTP_TIMEOUT_MS;
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const maxEventFetches =
    options.maxEventFetches ?? MAPADO_ENRICHMENT_MAX_EVENT_FETCHES;
  const candidates = options.events.filter((event) =>
    isMapadoTenantCandidate(tenant, event),
  );

  const result: MapadoEnrichmentResult = {
    tenantId: tenant.id,
    provider: tenant.provider,
    portalUrl: tenant.portalUrl,
    examinedCount: candidates.length,
    catalogSize: 0,
    knownUrlCount: 0,
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

  const knownUrls = await resolveKnownProviderEventUrls({
    tenant,
    eventIds: candidates.map((event) => event.id),
    injected: options.knownProviderEventUrls,
  });
  result.knownUrlCount = knownUrls.size;

  let portalHtml: string | null = null;
  try {
    const response = await fetchImpl(
      tenant.portalUrl,
      withHttpTimeout(httpTimeoutMs, {
        headers: { "user-agent": "DetourAvailabilityBot/1.0" },
        redirect: "follow",
      }),
    );
    if (!response.ok) {
      result.errors.push(`portal_http_${response.status}`);
    } else {
      portalHtml = await response.text();
      result.portalFetchOk = true;
    }
  } catch (error) {
    result.errors.push(
      `portal_fetch:${error instanceof Error ? error.message : "unknown"}`,
    );
  }

  const catalog =
    portalHtml !== null
      ? parseMapadoPortalCatalog(portalHtml, tenant.portalUrl, {
          ignoredCatalogTitles: tenant.ignoredCatalogTitles,
        })
      : [];
  result.catalogSize = catalog.length;
  if (portalHtml !== null && catalog.length === 0) {
    result.errors.push("portal_catalog_empty");
  }

  if (catalog.length === 0 && knownUrls.size === 0) {
    return result;
  }

  let eventFetches = 0;

  for (const event of candidates) {
    const knownUrl = knownUrls.get(event.id) ?? null;
    const catalogMatch =
      !knownUrl && catalog.length > 0
        ? matchMapadoCatalogEntry(event, catalog)
        : null;
    const eventUrl = knownUrl ?? catalogMatch?.eventUrl ?? null;
    const urlSource: "known_url" | "catalog" | null = knownUrl
      ? "known_url"
      : catalogMatch
        ? "catalog"
        : null;

    if (!eventUrl || !urlSource) {
      result.unknownCount += 1;
      continue;
    }

    if (eventFetches >= maxEventFetches) {
      result.errors.push("event_fetch_cap");
      result.unknownCount += 1;
      continue;
    }

    result.matchCount += 1;
    eventFetches += 1;
    let status: EventAvailabilityStatus | null = null;

    try {
      const response = await fetchImpl(
        eventUrl,
        withHttpTimeout(httpTimeoutMs, {
          headers: { "user-agent": "DetourAvailabilityBot/1.0" },
          redirect: "follow",
        }),
      );
      if (!response.ok) {
        result.errors.push(`event_http_${response.status}:${event.id}`);
        result.unknownCount += 1;
        result.matched.push({
          eventId: event.id,
          title: event.title,
          eventUrl,
          status: null,
          source: urlSource,
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
        source: urlSource,
      });
      continue;
    }

    result.matched.push({
      eventId: event.id,
      title: event.title,
      eventUrl,
      status,
      source: urlSource,
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

async function resolveKnownProviderEventUrls(params: {
  tenant: MapadoTenantConfig;
  eventIds: string[];
  injected?: ReadonlyMap<string, string>;
}): Promise<Map<string, string>> {
  if (params.injected) {
    return filterKnownUrlsForTenant(
      params.injected,
      params.tenant,
      params.eventIds,
    );
  }

  try {
    const { listAvailabilityByEventIds } = await import(
      "@/infrastructure/db/event-availability.repository"
    );
    const records = await listAvailabilityByEventIds(params.eventIds);
    const raw = new Map<string, string>();
    for (const eventId of params.eventIds) {
      const record = records.get(eventId);
      if (!record?.providerEventUrl) continue;
      if (record.provider !== params.tenant.provider) continue;
      raw.set(eventId, record.providerEventUrl);
    }
    return filterKnownUrlsForTenant(raw, params.tenant, params.eventIds);
  } catch (error) {
    // Best-effort : sans DB on continue sur le catalogue seul.
    void error;
    return new Map();
  }
}

function filterKnownUrlsForTenant(
  urls: ReadonlyMap<string, string>,
  tenant: MapadoTenantConfig,
  eventIds: readonly string[],
): Map<string, string> {
  let portalOrigin: string;
  try {
    portalOrigin = new URL(tenant.portalUrl).origin;
  } catch {
    return new Map();
  }

  const allowed = new Set(eventIds);
  const filtered = new Map<string, string>();
  for (const [eventId, url] of urls) {
    if (!allowed.has(eventId)) continue;
    try {
      if (new URL(url).origin !== portalOrigin) continue;
    } catch {
      continue;
    }
    filtered.set(eventId, url);
  }
  return filtered;
}
