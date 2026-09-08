import type { EventAvailabilityStatus } from "@/domain/events/event-availability";

export type EventRelevance =
  | "culture"
  | "culture_leisure"
  | "out_of_scope"
  | "uncertain";

export type DetourEvent = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;

  startAt: string;
  endAt: string | null;
  /**
   * Événement date-only / journée entière.
   * Quand true, `endAt` est une borne exclusive (convention RFC 5545 / sources all-day).
   */
  allDay?: boolean;

  venue: string | null;
  city: string | null;

  latitude: number | null;
  longitude: number | null;

  category: string | null;
  genre: string | null;
  conditions: string | null;

  source: string | null;
  sourceUrl: string | null;
  /** Lien de réservation / inscription extrait de registration, si présent. */
  registrationUrl: string | null;

  /**
   * Disponibilité billetterie résolue (fraîche) — générique, jamais un nom de provider.
   * Absent ou non renseigné ≡ unknown.
   */
  availabilityStatus?: EventAvailabilityStatus;
  /** Instant du dernier check persisté (debug / fraîcheur). */
  availabilityCheckedAt?: string | null;
  /** Provider infra du dernier check (debug uniquement). */
  availabilityProvider?: string | null;
  /**
   * URL de réservation fiable issue de l’enrichissement dispo (deep-link),
   * si connue — générique, pas liée à un provider nommé côté UI.
   */
  bookingUrl?: string | null;

  /** Pertinence culturelle Détour — calculée par le métier, pas par la source. */
  relevance?: EventRelevance;
  /** Raison machine-lisible de la classification. */
  relevanceReason?: string;
};
