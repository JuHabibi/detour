import type { EventAvailabilityStatus } from "@/domain/events/event-availability";

export type EventRelevance =
  | "culture"
  | "culture_leisure"
  | "out_of_scope"
  | "uncertain";

/** Séance explicitement datée par la source ; aucune récurrence déduite. */
export type EventOccurrence = {
  startAt: string;
  endAt: string;
  /** Si true, endAt est exclusif, comme pour DetourEvent.allDay. */
  allDay: boolean;
};

export type DetourEvent = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  /**
   * Attribution image (Commons, etc.) — générique, pas lié à une source.
   * Absents / null si non applicables (fallback local, source sans licence).
   */
  imageCredit?: string | null;
  imageLicense?: string | null;
  /** Page source de l’image (ex. fiche fichier Wikimedia Commons). */
  imageSourceUrl?: string | null;

  startAt: string;
  endAt: string | null;
  /** Dates source conservées quand startAt/endAt projettent une séance en lecture. */
  sourceDates?: { startAt: string; endAt: string | null };
  /**
   * Événement date-only / journée entière.
   * Quand true, `endAt` est une borne exclusive (convention RFC 5545 / sources all-day).
   */
  allDay?: boolean;

  /**
   * Séances explicites : snapshot complet à l’ingestion, limité à la fenêtre
   * pour les lectures de listes.
   * Absent : calendrier inconnu, préserver le dernier snapshot stocké.
   * [] : calendrier explicitement vide, remplacer les anciennes séances.
   * Un snapshot devenu obsolète est exposé comme [] en lecture.
   */
  occurrences?: EventOccurrence[];

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
   * Première insertion connue dans la DB Détour (`events.created_at`).
   * Ce n’est **pas** la date d’annonce par l’organisateur.
   * Absent hors lecture database (adapters live).
   */
  detourFirstInsertedAt?: string | null;

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
