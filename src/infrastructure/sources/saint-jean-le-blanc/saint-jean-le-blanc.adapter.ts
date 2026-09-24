import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import { parseSjlbDetail } from "./saint-jean-le-blanc.detail-parser";
import {
  absoluteSjlbUrl,
  assertSjlbUsableHtml,
  buildSjlbListPageUrl,
  SJLB_ORIGIN,
  SJLB_PAGE_SIZE,
} from "./saint-jean-le-blanc.html";
import { parseSjlbListPage } from "./saint-jean-le-blanc.list-parser";
import {
  mapSjlbDetailToDetourEvent,
  sjlbEventIntersectsWindow,
} from "./saint-jean-le-blanc.mapper";
import type {
  SjlbCollectStats,
  SjlbExclusion,
  SjlbListItem,
} from "./saint-jean-le-blanc.types";

export const SJLB_LIST_URL = absoluteSjlbUrl("/Liste_agenda_1/");

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_DETAIL_CONCURRENCY = 3;

export type SjlbFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SjlbAdapterConfig = {
  origin?: string;
  fetchImpl?: SjlbFetch;
  httpTimeoutMs?: number;
  detailConcurrency?: number;
  pageSize?: number;
};

export type SjlbCollectResult = {
  events: DetourEvent[];
  exclusions: SjlbExclusion[];
  stats: SjlbCollectStats;
};

type ResolvedSjlbConfig = {
  origin: string;
  fetchImpl: SjlbFetch;
  httpTimeoutMs: number;
  detailConcurrency: number;
  pageSize: number;
};

/** Façade EventSource — logique dans `collectSjlbEvents`. */
export class SaintJeanLeBlancEventAdapter implements EventSource {
  constructor(private readonly config: SjlbAdapterConfig = {}) {}

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const result = await collectSjlbEvents(params, this.config);
    return result.events;
  }

  /**
   * Collecte dry-run / diagnostics : events + exclusions + compteurs.
   * Même chemin fail-closed que `fetchUpcomingEvents`.
   */
  async collectUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<SjlbCollectResult> {
    return collectSjlbEvents(params, this.config);
  }
}

export async function collectSjlbEvents(
  params: { from: Date; to: Date },
  config: SjlbAdapterConfig = {},
): Promise<SjlbCollectResult> {
  const resolved = resolveSjlbConfig(config);
  const { items: listItems, listPagesFetched } =
    await fetchAllSjlbListItems(resolved);

  const exclusions: SjlbExclusion[] = [];
  const events: DetourEvent[] = [];
  let detailsFetched = 0;

  const detailResults = await mapPool(
    listItems,
    resolved.detailConcurrency,
    async (item) => {
      try {
        const html = await fetchSjlbHtml(item.detailUrl, resolved);
        const detail = parseSjlbDetail(html, item.detailUrl, {
          origin: resolved.origin,
        });
        if (!detail.theme && item.theme) detail.theme = item.theme;
        if (!detail.imageUrl && item.imageUrl) detail.imageUrl = item.imageUrl;
        return { ok: true as const, detail, item };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false as const,
          item,
          reason: /HTTP error/i.test(message)
            ? ("http_error" as const)
            : ("detail_parse_error" as const),
          message,
        };
      }
    },
  );

  const detailFailures = detailResults.filter((r) => !r.ok);
  if (detailFailures.length > 0) {
    const first = detailFailures[0]!;
    throw new Error(
      `Saint-Jean-le-Blanc detail failed (${detailFailures.length}/${listItems.length}): ${first.message}`,
    );
  }

  for (const result of detailResults) {
    if (!result.ok) continue;

    detailsFetched += 1;
    const mapped = mapSjlbDetailToDetourEvent(result.detail);
    if (!mapped.ok) {
      exclusions.push(mapped.exclusion);
      continue;
    }

    if (!sjlbEventIntersectsWindow(mapped.event, params.from, params.to)) {
      exclusions.push({
        resourceId: result.detail.resourceId,
        detailPath: result.detail.detailPath,
        title: result.detail.title,
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
      listPagesFetched,
      discovered: listItems.length,
      detailsFetched,
      detailsFailed: 0,
      published: events.length,
      excluded: exclusions.length,
    },
  };
}

function resolveSjlbConfig(config: SjlbAdapterConfig): ResolvedSjlbConfig {
  return {
    origin: config.origin ?? SJLB_ORIGIN,
    fetchImpl: config.fetchImpl ?? fetch,
    httpTimeoutMs: config.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    detailConcurrency: config.detailConcurrency ?? DEFAULT_DETAIL_CONCURRENCY,
    pageSize: config.pageSize ?? SJLB_PAGE_SIZE,
  };
}

async function fetchAllSjlbListItems(
  config: ResolvedSjlbConfig,
): Promise<{ items: SjlbListItem[]; listPagesFetched: number }> {
  const firstUrl = buildSjlbListPageUrl(1, config.origin, config.pageSize);
  const firstHtml = await fetchSjlbHtml(firstUrl, config);
  const firstPage = parseSjlbListPage(firstHtml, {
    origin: config.origin,
    requireItems: true,
  });

  const observedPageSize = firstPage.items.length;
  if (observedPageSize === 0) {
    throw new Error("Saint-Jean-le-Blanc list: 0 .item_agenda on page 1");
  }

  const lastPageNumber = firstPage.lastPageNumber;
  const byId = new Map<string, SjlbListItem>();
  for (const item of firstPage.items) {
    byId.set(item.resourceId, item);
  }

  let listPagesFetched = 1;

  for (let page = 2; page <= lastPageNumber; page += 1) {
    const url = buildSjlbListPageUrl(page, config.origin, config.pageSize);
    const html = await fetchSjlbHtml(url, config);
    const isLast = page === lastPageNumber;
    // Toute page annoncée par le pager doit contenir ≥ 1 item (y compris la dernière).
    const parsed = parseSjlbListPage(html, {
      origin: config.origin,
      requireItems: true,
    });
    listPagesFetched += 1;

    if (parsed.items.length === 0) {
      throw new Error(
        isLast
          ? `Saint-Jean-le-Blanc incomplete pagination: empty last page ${page}`
          : `Saint-Jean-le-Blanc incomplete pagination: empty intermediate page ${page}`,
      );
    }

    if (!isLast && parsed.items.length !== observedPageSize) {
      throw new Error(
        `Saint-Jean-le-Blanc incomplete pagination: short intermediate page ${page} (${parsed.items.length} < ${observedPageSize})`,
      );
    }

    if (isLast && parsed.items.length > observedPageSize) {
      throw new Error(
        `Saint-Jean-le-Blanc incomplete pagination: last page larger than page size (${parsed.items.length} > ${observedPageSize})`,
      );
    }

    for (const item of parsed.items) {
      if (!byId.has(item.resourceId)) {
        byId.set(item.resourceId, item);
      }
    }
  }

  return { items: [...byId.values()], listPagesFetched };
}

async function fetchSjlbHtml(
  url: string,
  config: ResolvedSjlbConfig,
): Promise<string> {
  let response: Response;
  try {
    response = await config.fetchImpl(url, {
      signal: AbortSignal.timeout(config.httpTimeoutMs),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "DetourBot/1.0 (+detour; agenda-sync)",
      },
      redirect: "follow",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Saint-Jean-le-Blanc HTTP error: ${message} (${url})`);
  }

  if (!response.ok) {
    throw new Error(
      `Saint-Jean-le-Blanc HTTP error: ${response.status} ${response.statusText} (${url})`,
    );
  }

  const html = await response.text();
  assertSjlbUsableHtml(html, `fetch`);
  return html;
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
