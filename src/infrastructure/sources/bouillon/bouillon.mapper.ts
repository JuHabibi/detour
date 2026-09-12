import type { DetourEvent } from "@/domain/events/event";
import type { BouillonDetail, BouillonExclusion } from "./bouillon.types";

export const BOUILLON_ADAPTER_ID = "bouillon";
export const BOUILLON_SOURCE_NAME = "Université d'Orléans / Le Bouillon";
export const BOUILLON_CITY = "Orléans";
export const BOUILLON_VENUE = "Le Bouillon";

export type BouillonMapResult =
  | { ok: true; event: DetourEvent }
  | { ok: false; exclusion: BouillonExclusion };

/**
 * Mappe une fiche Bouillon vers DetourEvent.
 * N’invente pas de champs hors modèle ; venue/city fiables pour cette source.
 */
export function mapBouillonDetailToDetourEvent(
  detail: BouillonDetail,
): BouillonMapResult {
  if (!detail.nid) {
    return {
      ok: false,
      exclusion: {
        nid: null,
        path: detail.path,
        title: detail.title,
        reason: "missing_nid",
      },
    };
  }

  if (!detail.title.trim()) {
    return {
      ok: false,
      exclusion: {
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
        reason: "missing_title",
      },
    };
  }

  if (!detail.startAt || Number.isNaN(Date.parse(detail.startAt))) {
    return {
      ok: false,
      exclusion: {
        nid: detail.nid,
        path: detail.path,
        title: detail.title,
        reason: "unparseable_date",
        detail: detail.startAt,
      },
    };
  }

  return {
    ok: true,
    event: {
      id: `${BOUILLON_ADAPTER_ID}:${detail.nid}`,
      title: detail.title.trim(),
      description: detail.bodyText,
      imageUrl: null,
      imageCredit: null,
      imageLicense: null,
      imageSourceUrl: null,
      startAt: detail.startAt,
      endAt: detail.endAt,
      venue: BOUILLON_VENUE,
      city: BOUILLON_CITY,
      latitude: detail.latitude,
      longitude: detail.longitude,
      category: detail.category,
      genre: null,
      conditions: null,
      source: BOUILLON_SOURCE_NAME,
      sourceUrl: detail.canonicalUrl,
      registrationUrl: detail.registrationUrl,
    },
  };
}

export function bouillonEventIntersectsWindow(
  event: DetourEvent,
  from: Date,
  to: Date,
): boolean {
  const start = Date.parse(event.startAt);
  if (Number.isNaN(start)) return false;

  const end = event.endAt ? Date.parse(event.endAt) : Number.NaN;
  const exclusiveEnd = Number.isNaN(end) ? start + 1 : end;

  return start < to.getTime() && exclusiveEnd > from.getTime();
}
