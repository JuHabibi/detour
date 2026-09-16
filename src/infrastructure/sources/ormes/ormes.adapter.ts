import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import { parseOrmesDetail } from "./ormes.detail-parser";
import { assertOrmesListHtml } from "./ormes.list-html";
import {
  absoluteOrmesUrl,
  ORMES_CULTURE_LIST_PATH,
  ORMES_ORIGIN,
  parseOrmesListPage,
} from "./ormes.list-parser";
import {
  mapOrmesDetailToDetourEvent,
  ormesEventIntersectsWindow,
} from "./ormes.mapper";
import type {
  OrmesCollectStats,
  OrmesExclusion,
  OrmesListItem,
} from "./ormes.types";

export const ORMES_CULTURE_LIST_URL = `${ORMES_ORIGIN}${ORMES_CULTURE_LIST_PATH}`;

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
/** Plafond prudent face au rate-limit ~10 req / 10 s. */
const DEFAULT_MIN_INTERVAL_MS = 1_000;
const MAX_LIST_PAGES = 20;

export type OrmesFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type OrmesAdapterConfig = {
  listUrl?: string;
  fetchImpl?: OrmesFetch;
  httpTimeoutMs?: number;
  /** Délai minimum entre deux requêtes HTTP (défaut 1s). */
  minIntervalMs?: number;
  /** Horloge injectable — tests rate-limit. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type OrmesCollectResult = {
  events: DetourEvent[];
  exclusions: OrmesExclusion[];
  stats: OrmesCollectStats;
};

type ResolvedOrmesConfig = {
  listUrl: string;
  fetchImpl: OrmesFetch;
  httpTimeoutMs: number;
  minIntervalMs: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

/** Façade EventSource — logique dans `collectOrmesEvents`. */
export class OrmesEventAdapter implements EventSource {
  constructor(private readonly config: OrmesAdapterConfig = {}) {}

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const result = await collectOrmesEvents(params, this.config);
    return result.events;
  }

  async collectUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<OrmesCollectResult> {
    return collectOrmesEvents(params, this.config);
  }
}

export async function collectOrmesEvents(
  params: { from: Date; to: Date },
  config: OrmesAdapterConfig = {},
): Promise<OrmesCollectResult> {
  const resolved = resolveOrmesConfig(config);
  const pace = createPaceGate(resolved);

  const listItems = await fetchAllOrmesListItems(resolved, pace);
  const exclusions: OrmesExclusion[] = [];
  const events: DetourEvent[] = [];
  let detailsFetched = 0;

  for (const item of listItems) {
    let html: string;
    try {
      html = await fetchOrmesHtml(item.url, resolved, pace);
      detailsFetched += 1;
    } catch (error) {
      exclusions.push({
        id: null,
        slug: item.slug,
        title: item.title,
        reason: "http_error",
        detail: error instanceof Error ? error.message : "fetch_failed",
      });
      continue;
    }

    const detail = parseOrmesDetail(html, item.url);
    const mapped = mapOrmesDetailToDetourEvent(detail);
    if (!mapped.ok) {
      exclusions.push(mapped.exclusion);
      continue;
    }

    if (!ormesEventIntersectsWindow(mapped.event, params.from, params.to)) {
      exclusions.push({
        id: detail.eventId,
        slug: detail.slug,
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
      detailsFetched,
      published: events.length,
      excluded: exclusions.length,
    },
  };
}

async function fetchAllOrmesListItems(
  config: ResolvedOrmesConfig,
  pace: PaceGate,
): Promise<OrmesListItem[]> {
  const items: OrmesListItem[] = [];
  const seen = new Set<string>();
  let pageUrl: string | null = config.listUrl;
  let pages = 0;

  while (pageUrl && pages < MAX_LIST_PAGES) {
    pages += 1;
    const html = await fetchOrmesHtml(pageUrl, config, pace);
    // Challenge / HTML hors EM → throw (jamais [] silencieux).
    assertOrmesListHtml(html, pageUrl);
    const parsed = parseOrmesListPage(html, pageUrl);

    for (const item of parsed.items) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      items.push(item);
    }
    pageUrl = parsed.nextPageUrl
      ? absoluteOrmesUrl(parsed.nextPageUrl, ORMES_ORIGIN)
      : null;
  }

  return items;
}

async function fetchOrmesHtml(
  url: string,
  config: ResolvedOrmesConfig,
  pace: PaceGate,
): Promise<string> {
  await pace.wait();
  let response = await fetchWithTimeout(url, config);

  if (response.status === 429) {
    await config.sleep(10_000);
    await pace.wait();
    response = await fetchWithTimeout(url, config);
    if (!response.ok) {
      throw new Error(
        `Ormes HTTP error: ${response.status} ${response.statusText} (${url})`,
      );
    }
  } else if (!response.ok) {
    throw new Error(
      `Ormes HTTP error: ${response.status} ${response.statusText} (${url})`,
    );
  }

  return response.text();
}

async function fetchWithTimeout(
  url: string,
  config: ResolvedOrmesConfig,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.httpTimeoutMs);
  try {
    return await config.fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "DetourBot/1.0 (+detour; agenda-sync)",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

type PaceGate = { wait: () => Promise<void> };

function createPaceGate(config: ResolvedOrmesConfig): PaceGate {
  let lastAt = 0;
  return {
    async wait() {
      const now = config.now();
      const elapsed = now - lastAt;
      const waitMs = config.minIntervalMs - elapsed;
      if (lastAt > 0 && waitMs > 0) {
        await config.sleep(waitMs);
      }
      lastAt = config.now();
    },
  };
}

function resolveOrmesConfig(config: OrmesAdapterConfig): ResolvedOrmesConfig {
  return {
    listUrl: config.listUrl ?? ORMES_CULTURE_LIST_URL,
    fetchImpl: config.fetchImpl ?? fetch,
    httpTimeoutMs: config.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    minIntervalMs: config.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
    now: config.now ?? (() => Date.now()),
    sleep: config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
  };
}
