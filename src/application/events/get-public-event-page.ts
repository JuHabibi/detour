import {
  mapDetourEventToEventItem,
  withEventItemDates,
} from "@/application/map-detour-event-to-ui";
import { eventForDisplay } from "@/domain/events/event-schedule";
import type { EventItem } from "@/data/types";
import { isEventStillActive } from "@/domain/events/is-event-still-active";
import {
  getEventRecordById,
  type EventRecord,
} from "@/infrastructure/db/event.repository";

/** Données cacheables — sans statut temporel (calculé à la requête). */
export type PublicEventPageSnapshot = {
  eventId: string;
  item: EventItem;
  startAt: string;
  endAt: string | null;
};

export type PublicEventPageData = PublicEventPageSnapshot & {
  /** Actif en base mais plus affichable au sens fraîcheur (passé). */
  isEnded: boolean;
};

export type GetPublicEventSnapshotResult =
  { status: "ok"; data: PublicEventPageSnapshot } | { status: "not_found" };

export type GetPublicEventPageResult =
  { status: "ok"; data: PublicEventPageData } | { status: "not_found" };

export type GetPublicEventPageOptions = {
  now?: Date;
  loadRecord?: (eventId: string) => Promise<EventRecord | null>;
};

/**
 * Charge la fiche (DB) sans `isEnded` — résultat apte au Data Cache 6h.
 * - inconnu / désactivé → not_found
 * - panne DB : laisse remonter (jamais convertie en 404)
 */
export async function getPublicEventSnapshot(
  eventId: string,
  options: Pick<GetPublicEventPageOptions, "loadRecord"> = {},
): Promise<GetPublicEventSnapshotResult> {
  const trimmed = eventId.trim();
  if (!trimmed) return { status: "not_found" };

  const load = options.loadRecord ?? getEventRecordById;
  const record = await load(trimmed);
  if (!record || !record.isActive) {
    return { status: "not_found" };
  }

  const item = mapDetourEventToEventItem(record.event);

  return {
    status: "ok",
    data: {
      eventId: record.event.id,
      item,
      startAt: record.event.startAt,
      endAt: record.event.endAt,
    },
  };
}

/** Applique `isEventStillActive` à l’horloge de la requête (hors cache). */
export function applyPublicEventEndedStatus(
  result: GetPublicEventSnapshotResult,
  now: Date = new Date(),
): GetPublicEventPageResult {
  if (result.status !== "ok") return result;

  const dates = eventForDisplay(
    {
      startAt: result.data.startAt,
      endAt: result.data.endAt,
      allDay: result.data.item.allDay,
      occurrences: result.data.item.occurrences,
    },
    now,
  );
  const unavailable = dates.occurrences?.length === 0;
  const isEnded = !unavailable && !isEventStillActive(dates, now);

  return {
    status: "ok",
    data: {
      ...result.data,
      startAt: dates.startAt,
      endAt: dates.endAt,
      item: unavailable
        ? result.data.item
        : withEventItemDates(result.data.item, dates),
      isEnded,
    },
  };
}

/**
 * Fiche publique V1 (snapshot DB + isEnded à `now`).
 * Préférer le chemin cache + `applyPublicEventEndedStatus` en production.
 */
export async function getPublicEventPage(
  eventId: string,
  options: GetPublicEventPageOptions = {},
): Promise<GetPublicEventPageResult> {
  const snapshot = await getPublicEventSnapshot(eventId, options);
  return applyPublicEventEndedStatus(snapshot, options.now ?? new Date());
}
