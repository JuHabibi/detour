import type { DetourEvent } from "@/domain/events/event";
import type {
  IngreMediathequeExclusion,
  IngreMediathequeListingSession,
  IngreMediathequeRssItem,
} from "./ingre-mediatheque.types";

export const INGRE_MEDIATHEQUE_SOURCE_NAME =
  "Médiathèque-Ludothèque La Parenthèse (Ingré)";
export const INGRE_MEDIATHEQUE_CITY = "Ingré";
export const INGRE_MEDIATHEQUE_ADAPTER_ID = "ingre-mediatheque";

export type IngreMediathequeMapResult =
  | { ok: true; event: DetourEvent }
  | { ok: false; exclusion: IngreMediathequeExclusion };

/**
 * Combine un item RSS (titre, description, début) et la séance listing (nid, fin).
 * L’identifiant stable est le NID Decalog de la séance.
 *
 * Lieu : RSS + listing n’exposent pas de champ lieu structuré → `venue: null`
 * (pas d’attribution inventée à La Parenthèse). `city: Ingré` = commune de la source.
 * `source` nomme l’équipement éditeur du portail.
 *
 * Image : absente du RSS/listing collectés ; certaines fiches HTML ont un thumb
 * (non fetchées ici). Ce n’est pas un rejet allowlist `next/image`.
 */
export function mapIngreMediathequeSession(params: {
  rss: IngreMediathequeRssItem;
  listing: IngreMediathequeListingSession;
}): IngreMediathequeMapResult {
  const title = params.rss.title.trim();
  if (!title) {
    return {
      ok: false,
      exclusion: {
        title: params.rss.title,
        nid: params.listing.nid,
        reason: "missing_title",
      },
    };
  }

  if (!params.rss.startAt) {
    return {
      ok: false,
      exclusion: {
        title,
        nid: params.listing.nid,
        reason: "unparseable_pub_date",
        detail: params.rss.pubDateRaw,
      },
    };
  }

  return {
    ok: true,
    event: {
      id: `${INGRE_MEDIATHEQUE_ADAPTER_ID}:${params.listing.nid}`,
      title,
      description: params.rss.description,
      imageUrl: null,
      startAt: params.rss.startAt,
      endAt: params.listing.endAt,
      venue: null,
      city: INGRE_MEDIATHEQUE_CITY,
      latitude: null,
      longitude: null,
      category: null,
      genre: null,
      conditions: null,
      source: INGRE_MEDIATHEQUE_SOURCE_NAME,
      sourceUrl: params.listing.detailUrl,
      registrationUrl: null,
    },
  };
}

export function ingreMediathequeEventIntersectsWindow(
  event: DetourEvent,
  from: Date,
  to: Date,
): boolean {
  const start = Date.parse(event.startAt);
  if (Number.isNaN(start)) return false;
  const end = event.endAt ? Date.parse(event.endAt) : start;
  const endMs = Number.isNaN(end) ? start : end;
  return start < to.getTime() && endMs >= from.getTime();
}
