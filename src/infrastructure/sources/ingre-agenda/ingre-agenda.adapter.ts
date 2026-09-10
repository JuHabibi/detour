import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import {
  absoluteIngreUrl,
  parseIngreAgendaDetail,
} from "./ingre-agenda.detail-parser";
import { parseIngreAgendaListPage } from "./ingre-agenda.list-parser";
import {
  ingreAgendaEventIntersectsWindow,
  mapIngreAgendaDetailToDetourEvent,
} from "./ingre-agenda.mapper";
import type {
  IngreAgendaCollectStats,
  IngreAgendaExclusion,
  IngreAgendaListItem,
} from "./ingre-agenda.types";

export const INGRE_AGENDA_BASE_URL = "https://www.ingre.fr/agenda";

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_DETAIL_CONCURRENCY = 3;

export type IngreAgendaFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type IngreAgendaAdapterConfig = {
  baseUrl?: string;
  fetchImpl?: IngreAgendaFetch;
  httpTimeoutMs?: number;
  detailConcurrency?: number;
};

export type IngreAgendaCollectResult = {
  events: DetourEvent[];
  exclusions: IngreAgendaExclusion[];
  stats: IngreAgendaCollectStats;
};

type ResolvedIngreAgendaConfig = {
  baseUrl: string;
  fetchImpl: IngreAgendaFetch;
  httpTimeoutMs: number;
  detailConcurrency: number;
};

/** Façade EventSource — logique dans `collectIngreAgendaEvents`. */
export class IngreAgendaEventAdapter implements EventSource {
  constructor(private readonly config: IngreAgendaAdapterConfig = {}) {}

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const result = await collectIngreAgendaEvents(params, this.config);
    return result.events;
  }

  /**
   * Collecte dry-run / diagnostics : events + exclusions + compteurs.
   * Même chemin fail-closed que `fetchUpcomingEvents`.
   */
  async collectUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<IngreAgendaCollectResult> {
    return collectIngreAgendaEvents(params, this.config);
  }
}

export async function collectIngreAgendaEvents(
  params: { from: Date; to: Date },
  config: IngreAgendaAdapterConfig = {},
): Promise<IngreAgendaCollectResult> {
  const resolved = resolveIngreAgendaConfig(config);
  const listItems = await fetchAllIngreAgendaListItems(resolved);
  const exclusions: IngreAgendaExclusion[] = [];
  const events: DetourEvent[] = [];

  const details = await mapPool(
    listItems,
    resolved.detailConcurrency,
    async (item) => {
      const html = await fetchIngreAgendaHtml(
        absoluteIngreUrl(item.path),
        resolved,
      );
      return parseIngreAgendaDetail(html, item.path);
    },
  );

  for (const detail of details) {
    const mapped = mapIngreAgendaDetailToDetourEvent(detail);
    if (!mapped.ok) {
      exclusions.push(mapped.exclusion);
      continue;
    }

    if (
      !ingreAgendaEventIntersectsWindow(mapped.event, params.from, params.to)
    ) {
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

function resolveIngreAgendaConfig(
  config: IngreAgendaAdapterConfig,
): ResolvedIngreAgendaConfig {
  return {
    baseUrl: config.baseUrl ?? INGRE_AGENDA_BASE_URL,
    fetchImpl: config.fetchImpl ?? fetch,
    httpTimeoutMs: config.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    detailConcurrency:
      config.detailConcurrency ?? DEFAULT_DETAIL_CONCURRENCY,
  };
}

async function fetchAllIngreAgendaListItems(
  config: ResolvedIngreAgendaConfig,
): Promise<IngreAgendaListItem[]> {
  const firstHtml = await fetchIngreAgendaHtml(
    buildIngreAgendaListUrl(0, config.baseUrl),
    config,
  );
  const firstPage = parseIngreAgendaListPage(firstHtml);
  const lastPageIndex = firstPage.lastPageIndex;
  const pageSize = firstPage.items.length;

  if (lastPageIndex === 0) {
    return dedupeByNid(firstPage.items);
  }

  if (pageSize === 0) {
    throw new Error(
      "Ingré agenda incomplete pagination: empty first page while pager announces more",
    );
  }

  const byNid = new Map<string, IngreAgendaListItem>();
  for (const item of firstPage.items) {
    byNid.set(item.nid, item);
  }

  for (let page = 1; page <= lastPageIndex; page += 1) {
    const html = await fetchIngreAgendaHtml(
      buildIngreAgendaListUrl(page, config.baseUrl),
      config,
    );
    const parsed = parseIngreAgendaListPage(html);

    if (parsed.lastPageIndex !== lastPageIndex) {
      throw new Error(
        `Ingré agenda incomplete pagination: last page changed (${lastPageIndex} → ${parsed.lastPageIndex}) on page ${page}`,
      );
    }

    if (parsed.items.length === 0) {
      throw new Error(
        `Ingré agenda incomplete pagination: empty page ${page} before last`,
      );
    }

    const isLast = page === lastPageIndex;
    if (!isLast && parsed.items.length !== pageSize) {
      throw new Error(
        `Ingré agenda incomplete pagination: short page ${page} (${parsed.items.length} < ${pageSize})`,
      );
    }

    if (isLast && parsed.items.length > pageSize) {
      throw new Error(
        `Ingré agenda incomplete pagination: last page larger than page size (${parsed.items.length} > ${pageSize})`,
      );
    }

    for (const item of parsed.items) {
      if (!byNid.has(item.nid)) {
        byNid.set(item.nid, item);
      }
    }
  }

  return [...byNid.values()];
}

export function buildIngreAgendaListUrl(
  pageIndex: number,
  baseUrl: string = INGRE_AGENDA_BASE_URL,
): string {
  if (pageIndex <= 0) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("page", String(pageIndex));
  return url.toString();
}

async function fetchIngreAgendaHtml(
  url: string,
  config: ResolvedIngreAgendaConfig,
): Promise<string> {
  let response: Response;
  try {
    response = await config.fetchImpl(url, {
      signal: AbortSignal.timeout(config.httpTimeoutMs),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "DetourIngreAgendaBot/1.0 (+https://detour.local)",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Ingré agenda HTTP error: ${message} (${url})`);
  }

  if (!response.ok) {
    throw new Error(
      `Ingré agenda HTTP error: ${response.status} ${response.statusText} (${url})`,
    );
  }

  return response.text();
}

function dedupeByNid(items: IngreAgendaListItem[]): IngreAgendaListItem[] {
  const byNid = new Map<string, IngreAgendaListItem>();
  for (const item of items) {
    if (!byNid.has(item.nid)) byNid.set(item.nid, item);
  }
  return [...byNid.values()];
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
