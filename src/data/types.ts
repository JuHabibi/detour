import type { EventRelevance } from "@/domain/event";

export type CategoryId =
  | "tout"
  | "musique"
  | "spectacles"
  | "expos"
  | "cinema"
  | "famille"
  | "ateliers"
  | "other";

export type WhenFilter =
  | "today"
  | "tomorrow"
  | "weekend"
  | "next-week"
  | "this-month"
  | "next-month"
  | "upcoming";

export type RadiusFilter = 5 | 15 | 30 | 50;

export type EventSignal = "discover" | "nearby" | "free" | "intimate";

export type { EventRelevance };

export type EventItem = {
  id: string;
  title: string;
  category: CategoryId;
  genre: string;
  venue: string | null;
  city: string | null;
  date: string;
  dateLabel: string;
  /** Instant de début ISO — source de vérité pour les filtres temporels. */
  startAt?: string;
  /** Instant de fin ISO — pour les événements multi-jours / encore en cours. */
  endAt?: string | null;
  time?: string;
  /** Absent tant que la distance n’est pas calculée. */
  distanceKm?: number;
  /** Absent tant que le prix n’est pas normalisé. */
  price?: number | "free";
  image?: string;
  imageAlt?: string;
  description?: string;
  /** Lien source (ex. fiche OpenAgenda). Absent si inconnu. */
  sourceUrl?: string;
  /** Lien de réservation / inscription, si extrait de registration. */
  registrationUrl?: string;
  /** Titre de l’agenda source (ex. OpenAgenda). */
  source?: string;
  /** Conditions / tarifs bruts, si fournis par la source. */
  conditions?: string;
  /** Pertinence culturelle Détour (métier). */
  relevance?: EventRelevance;
  /** Raison machine-lisible de la classification. */
  relevanceReason?: string;
  /** Flag éditorial — défini plus tard par le service, pas par le mapper. */
  detour?: boolean;
  /** Fait calendaire : l’événement tombe un samedi ou un dimanche. */
  weekend?: boolean;
  /** Flag éditorial — défini plus tard par le service, pas par le mapper. */
  upcoming?: boolean;
  signal?: EventSignal;
};
