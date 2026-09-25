import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import {
  INGRE_MEDIATHEQUE_ORIGIN,
  parseIngreMediathequeListing,
} from "./ingre-mediatheque.listing-parser";
import {
  ingreMediathequeEventIntersectsWindow,
  mapIngreMediathequeSession,
} from "./ingre-mediatheque.mapper";
import { parseIngreMediathequeRss } from "./ingre-mediatheque.rss-parser";
import type {
  IngreMediathequeCollectStats,
  IngreMediathequeExclusion,
} from "./ingre-mediatheque.types";

/** Flux RSS agenda Decalog — nid de la page agenda (spike). */
export const INGRE_MEDIATHEQUE_RSS_URL =
  "https://mediatheque-ludotheque.ingre.fr/agenda/rss/nid/533918?";

export const INGRE_MEDIATHEQUE_LISTING_URL =
  "https://mediatheque-ludotheque.ingre.fr/agenda-/-animations";

/** robots.txt Crawl-delay: 10 */
export const INGRE_MEDIATHEQUE_CRAWL_DELAY_MS = 10_000;

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;

export type IngreMediathequeFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type IngreMediathequeAdapterConfig = {
  origin?: string;
  rssUrl?: string;
  listingUrl?: string;
  fetchImpl?: IngreMediathequeFetch;
  httpTimeoutMs?: number;
  /** Délai entre requêtes HTTP vers l’hôte (défaut = crawl-delay robots). */
  crawlDelayMs?: number;
};

export type IngreMediathequeCollectResult = {
  events: DetourEvent[];
  exclusions: IngreMediathequeExclusion[];
  stats: IngreMediathequeCollectStats;
};

type ResolvedConfig = {
  origin: string;
  rssUrl: string;
  listingUrl: string;
  fetchImpl: IngreMediathequeFetch;
  httpTimeoutMs: number;
  crawlDelayMs: number;
};

export class IngreMediathequeEventAdapter implements EventSource {
  constructor(private readonly config: IngreMediathequeAdapterConfig = {}) {}

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const result = await collectIngreMediathequeEvents(params, this.config);
    return result.events;
  }

  async collectUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<IngreMediathequeCollectResult> {
    return collectIngreMediathequeEvents(params, this.config);
  }
}

/**
 * Collecte fail-closed : RSS + listing obligatoires et jointure complète.
 * Un item RSS sans séance listing → erreur (pas de snapshot partiel).
 */
export async function collectIngreMediathequeEvents(
  params: { from: Date; to: Date },
  config: IngreMediathequeAdapterConfig = {},
): Promise<IngreMediathequeCollectResult> {
  const resolved = resolveConfig(config);

  const rssXml = await fetchText(resolved.rssUrl, resolved, "application/rss+xml,application/xml,text/xml,*/*");
  await delay(resolved.crawlDelayMs);
  const listingHtml = await fetchText(
    resolved.listingUrl,
    resolved,
    "text/html,application/xhtml+xml",
  );

  const rssItems = parseIngreMediathequeRss(rssXml);
  const listingSessions = parseIngreMediathequeListing(listingHtml, {
    origin: resolved.origin,
  });

  assertUniqueStartKeys(
    rssItems.map((item) => item.startKey).filter(Boolean),
    "RSS",
  );

  const listingByStartKey = new Map(
    listingSessions.map((session) => [session.startKey, session]),
  );

  const unmatched: string[] = [];
  for (const item of rssItems) {
    if (!item.startKey || !listingByStartKey.has(item.startKey)) {
      unmatched.push(
        `${item.title || "(sans titre)"} @ ${item.pubDateRaw || "no-date"}`,
      );
    }
  }
  if (unmatched.length > 0) {
    throw new Error(
      `Ingré médiathèque incomplete join: ${unmatched.length}/${rssItems.length} RSS item(s) without listing session (${unmatched.slice(0, 3).join("; ")})`,
    );
  }

  const exclusions: IngreMediathequeExclusion[] = [];
  const events: DetourEvent[] = [];
  const seenIds = new Set<string>();

  for (const item of rssItems) {
    const listing = listingByStartKey.get(item.startKey)!;
    const mapped = mapIngreMediathequeSession({ rss: item, listing });
    if (!mapped.ok) {
      exclusions.push(mapped.exclusion);
      continue;
    }

    if (seenIds.has(mapped.event.id)) {
      throw new Error(
        `Ingré médiathèque duplicate event id after join: ${mapped.event.id}`,
      );
    }
    seenIds.add(mapped.event.id);

    if (
      !ingreMediathequeEventIntersectsWindow(
        mapped.event,
        params.from,
        params.to,
      )
    ) {
      exclusions.push({
        title: mapped.event.title,
        nid: listing.nid,
        reason: "outside_window",
        detail: mapped.event.startAt,
      });
      continue;
    }

    events.push(mapped.event);
  }

  return {
    events,
    exclusions,
    stats: {
      rssItems: rssItems.length,
      listingSessions: listingSessions.length,
      published: events.length,
      excluded: exclusions.length,
    },
  };
}

function resolveConfig(
  config: IngreMediathequeAdapterConfig,
): ResolvedConfig {
  return {
    origin: config.origin ?? INGRE_MEDIATHEQUE_ORIGIN,
    rssUrl: config.rssUrl ?? INGRE_MEDIATHEQUE_RSS_URL,
    listingUrl: config.listingUrl ?? INGRE_MEDIATHEQUE_LISTING_URL,
    fetchImpl: config.fetchImpl ?? fetch,
    httpTimeoutMs: config.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    crawlDelayMs:
      config.crawlDelayMs ?? INGRE_MEDIATHEQUE_CRAWL_DELAY_MS,
  };
}

async function fetchText(
  url: string,
  config: ResolvedConfig,
  accept: string,
): Promise<string> {
  let response: Response;
  try {
    response = await config.fetchImpl(url, {
      signal: AbortSignal.timeout(config.httpTimeoutMs),
      headers: {
        Accept: accept,
        "User-Agent": "DetourBot/1.0 (+detour; agenda-sync)",
      },
      redirect: "follow",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Ingré médiathèque HTTP error: ${message} (${url})`);
  }

  if (!response.ok) {
    throw new Error(
      `Ingré médiathèque HTTP error: ${response.status} ${response.statusText} (${url})`,
    );
  }

  return response.text();
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deux items distincts ne doivent pas partager la même clé de jointure. */
export function assertUniqueStartKeys(
  keys: string[],
  label: string,
): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(
        `Ingré médiathèque ${label} startKey collision: ${key}`,
      );
    }
    seen.add(key);
  }
}
