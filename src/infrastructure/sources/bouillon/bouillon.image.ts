import type { DetourEvent } from "@/domain/events/event";
import { resolveBouillonCategoryFallback } from "./bouillon.category-fallback";
import {
  logBouillonImageDebug,
  shouldDebugBouillonImage,
  type BouillonImageCandidateDebug,
  type BouillonImageDebugReason,
} from "./bouillon.image-debug";
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
  const debug = shouldDebugBouillonImage(event.title);
  const debugTraces: BouillonImageCandidateDebug[] | undefined = debug
    ? []
    : undefined;

  let wikimedia: WikimediaImageHit | null = null;
  let lookupError = false;

  try {
    wikimedia = await lookupWikimediaImageForCandidates(candidates, {
      ...config,
      eventCategory: event.category,
      debugTraces,
    });
  } catch {
    lookupError = true;
    // best-effort → fallback
  }

  if (wikimedia) {
    if (debug) {
      logBouillonImageDebug({
        title: event.title,
        candidates,
        candidateTraces: debugTraces ?? [],
        result: "wikimedia",
        reason: "accepted",
        imageUrl: wikimedia.imageUrl,
      });
    }
    return {
      ...event,
      imageUrl: wikimedia.imageUrl,
      imageCredit: wikimedia.imageCredit,
      imageLicense: wikimedia.imageLicense,
      imageSourceUrl: wikimedia.imageSourceUrl,
    };
  }

  const fallback = resolveBouillonCategoryFallback({
    category: event.category,
    title: event.title,
  });

  if (debug) {
    logBouillonImageDebug({
      title: event.title,
      candidates,
      candidateTraces: debugTraces ?? [],
      result: "fallback",
      reason: resolveFallbackReason(candidates, debugTraces, lookupError),
      imageUrl: fallback.imageUrl,
    });
  }

  return {
    ...event,
    imageUrl: fallback.imageUrl,
    imageCredit: null,
    imageLicense: null,
    imageSourceUrl: null,
  };
}

function resolveFallbackReason(
  candidates: string[],
  traces: BouillonImageCandidateDebug[] | undefined,
  lookupError: boolean,
): BouillonImageDebugReason {
  if (lookupError) return "lookup_error";
  if (candidates.length === 0) return "no_candidate";
  if (!traces || traces.length === 0) return "all_candidates_rejected";
  // Dernier candidat = étape la plus avancée souvent ; sinon première raison.
  return traces[traces.length - 1]?.reason ?? "all_candidates_rejected";
}
