import {
  buildEventCalendar,
  eventCalendarFilename,
  type BuildEventCalendarOptions,
} from "@/domain/calendar/build-event-calendar";
import { getEventById } from "@/infrastructure/db/event.repository";

export type EventCalendarPayload = {
  ics: string;
  filename: string;
};

/**
 * Charge un événement par id (source de vérité serveur) et construit l’ICS.
 * null si absent.
 */
export async function getEventCalendarForId(
  eventId: string,
  options?: BuildEventCalendarOptions,
): Promise<EventCalendarPayload | null> {
  const event = await getEventById(eventId);
  if (!event) return null;
  return {
    ics: buildEventCalendar(event, options),
    filename: eventCalendarFilename(event.title),
  };
}
