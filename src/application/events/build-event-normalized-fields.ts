import { isJeunePublicAudience } from "@/domain/events/audience-jeune-public";
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
  /** Facette audience `jeune_public` — SSOT `isJeunePublicAudience`. */
  audienceJeunePublic: boolean;
};

/**
 * Calcule les colonnes Explorer à partir du même DetourEvent que le sync.
 * Source de vérité : classifyEventCategory / matchV1Commune / isJeunePublicAudience.
 */
export function buildEventNormalizedFields(
  event: DetourEvent,
): EventNormalizedFields {
  return {
    productCategory: classifyEventCategory(event),
    cityKey: matchV1Commune(event.city),
    audienceJeunePublic: isJeunePublicAudience({
      title: event.title,
      description: event.description,
      category: event.category,
    }),
  };
}
