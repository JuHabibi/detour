import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import {
  absoluteBouillonUrl,
  BOUILLON_ORIGIN,
  parseBouillonDetail,
} from "./bouillon.detail-parser";
import {
  BOUILLON_LIST_PATH,
  parseBouillonListPage,
} from "./bouillon.list-parser";
import {
  bouillonEventIntersectsWindow,
  mapBouillonDetailToDetourEvent,
} from "./bouillon.mapper";
import { enrichBouillonDetailImage } from "./bouillon.image";
import type {
  BouillonCollectStats,
  BouillonExclusion,
  BouillonListItem,
} from "./bouillon.types";

export const BOUILLON_LIST_URL = `${BOUILLON_ORIGIN}${BOUILLON_LIST_PATH}`;

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_DETAIL_CONCURRENCY = 3;

export type BouillonFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type BouillonAdapterConfig = {
  listUrl?: string;
  fetchImpl?: BouillonFetch;
  httpTimeoutMs?: number;
  detailConcurrency?: number;
};

export type BouillonCollectResult = {
  events: DetourEvent[];
  exclusions: BouillonExclusion[];
  stats: BouillonCollectStats;
};

type ResolvedBouillonConfig = {
  listUrl: string;
  fetchImpl: BouillonFetch;
  httpTimeoutMs: number;
  detailConcurrency: number;
};

/** Façade EventSource — logique dans `collectBouillonEvents`. */
export class BouillonEventAdapter implements EventSource {
  constructor(private readonly config: BouillonAdapterConfig = {}) {}

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const result = await collectBouillonEvents(params, this.config);
    return result.events;
  }

  async collectUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<BouillonCollectResult> {
    return collectBouillonEvents(params, this.config);
  }
}

export async function collectBouillonEvents(
  params: { from: Date; to: Date },
  config: BouillonAdapterConfig = {},
): Promise<BouillonCollectResult> {
  const resolved = resolveBouillonConfig(config);
  const listItems = await fetchAllBouillonListItems(resolved);
  const exclusions: BouillonExclusion[] = [];
  const events: DetourEvent[] = [];

  const details = await mapPool(
    listItems,
    resolved.detailConcurrency,
    async (item) => {
      const html = await fetchBouillonHtml(
        absoluteBouillonUrl(item.path),
        resolved,
      );
      const detail = parseBouillonDetail(html, {
        fallbackPath: item.path,
        category: item.category,
      });
      return enrichBouillonDetailImage(detail, resolved);
    },
  );

  for (const detail of details) {
    const mapped = mapBouillonDetailToDetourEvent(detail);
    if (!mapped.ok) {
      exclusions.push(mapped.exclusion);
      continue;
    }

    if (!bouillonEventIntersectsWindow(mapped.event, params.from, params.to)) {
      exclusions.push({
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
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
      discovered: listItems.length,
      detailsFetched: details.length,
      published: events.length,
      excluded: exclusions.length,
    },
  };
}

function resolveBouillonConfig(
  config: BouillonAdapterConfig,
): ResolvedBouillonConfig {
  return {
    listUrl: config.listUrl ?? BOUILLON_LIST_URL,
    fetchImpl: config.fetchImpl ?? fetch,
    httpTimeoutMs: config.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    detailConcurrency:
      config.detailConcurrency ?? DEFAULT_DETAIL_CONCURRENCY,
  };
}

async function fetchAllBouillonListItems(
  config: ResolvedBouillonConfig,
): Promise<BouillonListItem[]> {
  const firstHtml = await fetchBouillonHtml(
    buildBouillonListUrl(0, config.listUrl),
    config,
  );
  const firstPage = parseBouillonListPage(firstHtml);
  const lastPageIndex = firstPage.lastPageIndex;
  const pageSize = firstPage.items.length;

  if (lastPageIndex === 0) {
    return dedupeByPath(firstPage.items);
  }

  if (pageSize === 0) {
    throw new Error(
      "Bouillon incomplete pagination: empty first page while pager announces more",
    );
  }

  const byPath = new Map<string, BouillonListItem>();
  for (const item of firstPage.items) {
    byPath.set(item.path, item);
  }

  for (let page = 1; page <= lastPageIndex; page += 1) {
    const html = await fetchBouillonHtml(
      buildBouillonListUrl(page, config.listUrl),
      config,
    );
    const parsed = parseBouillonListPage(html);

    if (parsed.lastPageIndex !== lastPageIndex) {
      throw new Error(
        `Bouillon incomplete pagination: last page changed (${lastPageIndex} → ${parsed.lastPageIndex}) on page ${page}`,
      );
    }

    if (parsed.items.length === 0) {
      throw new Error(
        `Bouillon incomplete pagination: empty page ${page} before last`,
      );
    }

    const isLast = page === lastPageIndex;
    if (!isLast && parsed.items.length !== pageSize) {
      throw new Error(
        `Bouillon incomplete pagination: short page ${page} (${parsed.items.length} < ${pageSize})`,
      );
    }

    if (isLast && parsed.items.length > pageSize) {
      throw new Error(
        `Bouillon incomplete pagination: last page larger than page size (${parsed.items.length} > ${pageSize})`,
      );
    }

    for (const item of parsed.items) {
      if (!byPath.has(item.path)) {
        byPath.set(item.path, item);
      }
    }
  }

  return [...byPath.values()];
}

export function buildBouillonListUrl(
  pageIndex: number,
  listUrl: string = BOUILLON_LIST_URL,
): string {
  if (pageIndex <= 0) return listUrl;
  const url = new URL(listUrl);
  url.searchParams.set("page", String(pageIndex));
  return url.toString();
}

async function fetchBouillonHtml(
  url: string,
  config: ResolvedBouillonConfig,
): Promise<string> {
  let response: Response;
  try {
    response = await config.fetchImpl(url, {
      signal: AbortSignal.timeout(config.httpTimeoutMs),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "DetourBouillonBot/1.0 (+https://detour.local)",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Bouillon HTTP error: ${message} (${url})`);
  }

  if (!response.ok) {
    throw new Error(
      `Bouillon HTTP error: ${response.status} ${response.statusText} (${url})`,
    );
  }

  return response.text();
}

function dedupeByPath(items: BouillonListItem[]): BouillonListItem[] {
  const byPath = new Map<string, BouillonListItem>();
  for (const item of items) {
    if (!byPath.has(item.path)) byPath.set(item.path, item);
  }
  return [...byPath.values()];
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
