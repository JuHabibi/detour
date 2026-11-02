import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { EventItem } from "@/data/types";
import { isEventStillActive } from "@/domain/events/is-event-still-active";
import {
  getEventRecordById,
  type EventRecord,
} from "@/infrastructure/db/event.repository";

export type PublicEventPageData = {
  eventId: string;
  item: EventItem;
  /** Actif en base mais plus affichable au sens fraîcheur (passé). */
  isEnded: boolean;
};

export type GetPublicEventPageResult =
  | { status: "ok"; data: PublicEventPageData }
  | { status: "not_found" };

export type GetPublicEventPageOptions = {
  now?: Date;
  loadRecord?: (eventId: string) => Promise<EventRecord | null>;
};

/**
 * Fiche publique V1 :
 * - actif + à venir/en cours → ok indexable (isEnded false)
 * - actif + passé → ok noindex (isEnded true)
 * - inconnu / désactivé → not_found
 * - panne DB : laisse remonter (jamais convertie en 404)
 */
export async function getPublicEventPage(
  eventId: string,
  options: GetPublicEventPageOptions = {},
): Promise<GetPublicEventPageResult> {
  const trimmed = eventId.trim();
  if (!trimmed) return { status: "not_found" };

  const load = options.loadRecord ?? getEventRecordById;
  const record = await load(trimmed);
  if (!record || !record.isActive) {
    return { status: "not_found" };
  }

  const now = options.now ?? new Date();
  const isEnded = !isEventStillActive(record.event, now);
  const item = mapDetourEventToEventItem(record.event);

  return {
    status: "ok",
    data: {
      eventId: record.event.id,
      item,
      isEnded,
    },
  };
}
