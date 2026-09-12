import type { DetourEvent } from "@/domain/events/event";
import { resolveBouillonCategoryFallback } from "./bouillon.category-fallback";
import { extractBouillonTitleCandidates } from "./bouillon.title-candidates";
import {
  lookupOpenverseImageForCandidates,
  type OpenverseImageHit,
} from "./bouillon.openverse";
import {
  lookupWikimediaImageForCandidates,
  type WikimediaFetch,
  type WikimediaImageHit,
} from "./bouillon.wikimedia";

export type BouillonImageEnrichConfig = {
  fetchImpl: WikimediaFetch;
  httpTimeoutMs: number;
  entityCache?: Map<string, WikimediaImageHit | null>;
  openverseCandidateCache?: Map<string, OpenverseImageHit | null>;
};

/**
 * Enrichissement image Bouillon :
 * Wikidata/Commons → Openverse → fallback catégorie.
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
      return applyImageHit(event, wikimedia);
    }
  } catch {
    // best-effort → Openverse
  }

  try {
    const openverse = await lookupOpenverseImageForCandidates(candidates, {
      fetchImpl: config.fetchImpl,
      httpTimeoutMs: config.httpTimeoutMs,
      candidateCache: config.openverseCandidateCache,
    });
    if (openverse) {
      return applyImageHit(event, openverse);
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

function applyImageHit(
  event: DetourEvent,
  hit: {
    imageUrl: string;
    imageCredit: string | null;
    imageLicense: string;
    imageSourceUrl: string;
  },
): DetourEvent {
  return {
    ...event,
    imageUrl: hit.imageUrl,
    imageCredit: hit.imageCredit,
    imageLicense: hit.imageLicense,
    imageSourceUrl: hit.imageSourceUrl,
  };
}
