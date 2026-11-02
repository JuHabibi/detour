import { cache } from "react";
import type { GetPublicEventPageResult } from "@/application/events/get-public-event-page";
import { getCachedPublicEventPage } from "@/infrastructure/next-public-event-cache";

/**
 * Page loader — Data Cache PG + `isEnded` à la requête.
 * `cache()` React : une seule résolution partagée page / generateMetadata.
 */
export const loadPublicEventPage = cache(
  async (eventId: string): Promise<GetPublicEventPageResult> => {
    return getCachedPublicEventPage(eventId);
  },
);
