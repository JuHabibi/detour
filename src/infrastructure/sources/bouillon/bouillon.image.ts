import type { DetourEvent } from "@/domain/events/event";
import { resolveBouillonCategoryFallback } from "./bouillon.category-fallback";
import { extractBouillonTitleCandidates } from "./bouillon.title-candidates";
import {
  lookupWikimediaImageForCandidates,
  type WikimediaFetch,
  type WikimediaImageHit,
} from "./bouillon.wikimedia";

export type BouillonImageEnrichConfig = {
  fetchImpl: WikimediaFetch;
  httpTimeoutMs: number;
  entityCache?: Map<string, WikimediaImageHit | null>;
};

/**
 * Enrichissement image Bouillon :
 * Wikidata/Commons (best-effort) → sinon fallback catégorie local.
 * Ne scrape ni Université ni Billetweb.
 */
export async function enrichBouillonEventImage(
  event: DetourEvent,
  config: BouillonImageEnrichConfig,
): Promise<DetourEvent> {
  try {
    const candidates = extractBouillonTitleCandidates(event.title);
    const hit = await lookupWikimediaImageForCandidates(candidates, config);
    if (hit) {
      return {
        ...event,
        imageUrl: hit.imageUrl,
        imageCredit: hit.imageCredit,
        imageLicense: hit.imageLicense,
        imageSourceUrl: hit.imageSourceUrl,
      };
    }
  } catch {
    // best-effort
  }

  const fallback = resolveBouillonCategoryFallback({
    category: event.category,
    title: event.title,
  });

  return {
    ...event,
    imageUrl: fallback.imageUrl,
    imageCredit: null,
    imageLicense: null,
    imageSourceUrl: null,
  };
}
