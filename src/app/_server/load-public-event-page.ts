import type { GetPublicEventPageResult } from "@/application/events/get-public-event-page";
import { getCachedPublicEventPage } from "@/infrastructure/next-public-event-cache";

/** Page loader — composition cache ; panne DB non convertie en 404. */
export async function loadPublicEventPage(
  eventId: string,
): Promise<GetPublicEventPageResult> {
  return getCachedPublicEventPage(eventId);
}
