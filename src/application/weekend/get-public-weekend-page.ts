import {
  mapDetourEventToEventItem,
  withEventItemDates,
} from "@/application/map-detour-event-to-ui";
import { selectEventInWindow } from "@/domain/events/event-schedule";
import { formatWeekendRangeLabel } from "@/application/weekend/format-weekend-range-label";
import {
  listCulturalActiveWeekendEvents,
  selectWeekendPageEvents,
  WEEKEND_PAGE_SELECTION_LIMIT,
} from "@/application/weekend/select-weekend-events";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import type { EventItem } from "@/data/types";
import type { DetourEvent } from "@/domain/events/event";
import { isEventStillActive } from "@/domain/events/is-event-still-active";
import {
  getDateRangeForWhenFilter,
  toParisDateKey,
} from "@/domain/time/when-filter";
import type { DbQueryable } from "@/infrastructure/db/postgres";

/** Lien Explorer — défaut produit = filtre « Ce week-end ». */
export const WEEKEND_PAGE_EXPLORER_HREF = "/explorer";

/** Pages max pour couvrir un week-end typique (50 × 3) sans boucle infinie. */
const WEEKEND_CORPUS_MAX_PAGES = 3;
const WEEKEND_CORPUS_PAGE_SIZE = 50;

export type PublicWeekendPage = {
  /** Clé samedi Europe/Paris (`YYYY-MM-DD`) — identité du week-end. */
  saturdayKey: string;
  sundayKey: string;
  weekendLabel: string;
  weekendFromIso: string;
  weekendToIso: string;
  events: EventItem[];
  /** Corpus culturel encore actif sur le week-end (avant plafond de sélection). */
  culturalActiveCount: number;
  explorerHref: string;
};

/**
 * Données page « Ce week-end » — PostgreSQL via Explorer, hors Radar / IA.
 */
export async function getPublicWeekendPage(options?: {
  now?: Date;
  client?: DbQueryable;
  limit?: number;
}): Promise<PublicWeekendPage> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? WEEKEND_PAGE_SELECTION_LIMIT;
  const range = getDateRangeForWhenFilter("weekend", now);
  if (!range.to) {
    throw new Error("weekend range requires an upper bound");
  }

  const saturdayKey = toParisDateKey(range.from);
  const sundayKey = toParisDateKey(range.to);
  const corpus = await listWeekendExplorerCorpus(now, options?.client);
  const selected = selectWeekendPageEvents(corpus, { now, limit });
  const culturalActiveCount = listCulturalActiveWeekendEvents(
    corpus,
    now,
  ).length;

  return {
    saturdayKey,
    sundayKey,
    weekendLabel: formatWeekendRangeLabel(range.from, range.to),
    weekendFromIso: range.from.toISOString(),
    weekendToIso: range.to.toISOString(),
    events: selected.map((event) => mapDetourEventToEventItem(event)),
    culturalActiveCount,
    explorerHref: WEEKEND_PAGE_EXPLORER_HREF,
  };
}

/**
 * Filtre les événements terminés hors cache (horloge de la requête).
 * Le snapshot peut contenir des items devenus passés pendant le TTL.
 */
export function applyWeekendPageEndedFilter(
  page: PublicWeekendPage,
  now: Date,
): PublicWeekendPage {
  return {
    ...page,
    events: page.events.flatMap((item) => {
      if (!item.startAt) return [];
      const selected = selectEventInWindow(
        { ...item, startAt: item.startAt, endAt: item.endAt ?? null },
        {
          from: new Date(page.weekendFromIso),
          to: new Date(page.weekendToIso),
          now,
        },
      );
      return selected && isEventStillActive(selected, now)
        ? [withEventItemDates(item, selected)]
        : [];
    }),
  };
}

async function listWeekendExplorerCorpus(
  now: Date,
  client?: DbQueryable,
): Promise<DetourEvent[]> {
  const events: DetourEvent[] = [];
  let cursor: string | null = null;

  for (
    let pageIndex = 0;
    pageIndex < WEEKEND_CORPUS_MAX_PAGES;
    pageIndex += 1
  ) {
    const page = await listExplorerEvents(
      {
        when: "weekend",
        limit: WEEKEND_CORPUS_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      },
      { now, client },
    );
    events.push(...page.events);
    cursor = page.nextCursor;
    if (!cursor) break;
  }

  return events;
}
