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
 * Wikidata/Commons → fallback catégorie.
 * Ne scrape ni Université ni Billetweb.
 */
export async function enrichBouillonEventImage(
  event: DetourEvent,
  config: BouillonImageEnrichConfig,
): Promise<DetourEvent> {
  const candidates = extractBouillonTitleCandidates(event.title);

  try {
    const wikimedia = await lookupWikimediaImageForCandidates(
      candidates,
      config,
    );
    if (wikimedia) {
      return {
        ...event,
        imageUrl: wikimedia.imageUrl,
        imageCredit: wikimedia.imageCredit,
        imageLicense: wikimedia.imageLicense,
        imageSourceUrl: wikimedia.imageSourceUrl,
      };
    }
  } catch {
    // best-effort → fallback
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
