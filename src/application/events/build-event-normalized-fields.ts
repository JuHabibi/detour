import {
  classifyEventCategory,
  type DetourCategory,
} from "@/domain/events/classify-event-category";
import type { DetourEvent } from "@/domain/events/event";
import { matchV1Commune } from "@/domain/geo/v1-communes";

/** Champs normalisés persistés pour Explorer (hors DetourEvent). */
export type EventNormalizedFields = {
  productCategory: DetourCategory;
  cityKey: string | null;
};

/**
 * Calcule les colonnes Explorer à partir du même DetourEvent que le sync.
 * Source de vérité : classifyEventCategory / matchV1Commune.
 */
export function buildEventNormalizedFields(
  event: DetourEvent,
): EventNormalizedFields {
  return {
    productCategory: classifyEventCategory(event),
    cityKey: matchV1Commune(event.city),
  };
}
