import {
  buildEventsCalendar,
  groupCalendarFilename,
  type BuildEventCalendarOptions,
} from "@/domain/calendar/build-event-calendar";
import { normalizeEventIds } from "@/application/groups";
import { getGroupWithEventsForUser } from "@/infrastructure/db/group.repository";

export type GroupCalendarPayload = {
  ics: string;
  filename: string;
  eventCount: number;
};

export type ExportGroupCalendarResult =
  | { status: "ok"; payload: GroupCalendarPayload }
  | { status: "not_found" }
  | { status: "empty" };

/**
 * Export ICS d’un groupe owned — source de vérité serveur.
 *
 * - Sans `eventIds` : tous les events du groupe.
 * - Avec `eventIds` : intersection stricte avec les memberships du groupe
 *   (ids hors groupe / absents ignorés — pas d’erreur bloquante).
 * - Groupe absent / non owned → `not_found`.
 * - Aucun event exportable → `empty` (pas d’ICS vide).
 */
export async function exportGroupCalendarForUser(params: {
  userId: string;
  groupId: string;
  eventIds?: readonly string[];
  options?: BuildEventCalendarOptions;
}): Promise<ExportGroupCalendarResult> {
  const group = await getGroupWithEventsForUser(params.userId, params.groupId);
  if (!group) return { status: "not_found" };

  const requested = params.eventIds
    ? normalizeEventIds([...params.eventIds])
    : null;

  let events = group.events;
  const selection = requested !== null && requested.length > 0;

  if (selection) {
    const wanted = new Set(requested);
    // Intersection membership — ordre du groupe préservé.
    events = group.events.filter((event) => wanted.has(event.id));
  }

  if (events.length === 0) return { status: "empty" };

  return {
    status: "ok",
    payload: {
      ics: buildEventsCalendar(events, params.options),
      filename: groupCalendarFilename(group.name, { selection }),
      eventCount: events.length,
    },
  };
}
