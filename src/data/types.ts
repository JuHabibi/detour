import type { EventRelevance } from "@/domain/events/event";
import type { DetourCategory } from "@/domain/events/classify-event-category";
import type { EditorialBadge } from "@/domain/editorial/resolve-editorial-badge";

export type { DetourCategory };

/** Filtre UI exploration — taxonomy Détour (+ Tout). */
export type CategoryId = "tout" | DetourCategory;

export type RadiusFilter = 5 | 15 | 30 | 50;

export type EventSignal = "discover" | "nearby" | "free" | "intimate";

export type { EventRelevance };

export type EventItem = {
  id: string;
  title: string;
  /** Catégorie produit normalisée Détour (filtres). */
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
  /**
   * Journée entière / date-only — `endAt` exclusif pour le calcul du label civil.
   */
  allDay?: boolean;
  time?: string;
  /** Absent tant que la distance n’est pas calculée. */
  distanceKm?: number;
  /** Absent tant que le prix n’est pas normalisé. */
  price?: number | "free";
  image?: string;
  imageAlt?: string;
  /** Crédit / auteur de l’image (affichage attribution CC). */
  imageCredit?: string;
  /** Licence courte normalisée (ex. CC BY-SA 4.0, CC0, Public Domain). */
  imageLicense?: string;
  /** URL de la fiche source de l’image (ex. Commons). */
  imageSourceUrl?: string;
  description?: string;
  /** Lien source (ex. fiche OpenAgenda). Absent si inconnu. */
  sourceUrl?: string;
  /** Lien de réservation / inscription, si extrait de registration. */
  registrationUrl?: string;
  /** Titre de l’agenda source (ex. OpenAgenda). */
  source?: string;
  /** Conditions / tarifs bruts, si fournis par la source. */
  conditions?: string;
  /** Catégorie brute source (debug). */
  sourceCategory?: string | null;
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
  /**
   * Pastille éditoriale section radar uniquement.
   * Calculée hors composant (assessment IA + registrationUrl).
   */
  editorialBadge?: EditorialBadge;
  /**
   * Pastille disponibilité billetterie (Explorer / cartes).
   * Uniquement sold_out* frais — jamais « Disponible ».
   */
  availabilityBadge?: "Complet" | "Complet en ligne";
  /** Statut dispo résolu (debug / UI). */
  availabilityStatus?: "available" | "sold_out_online" | "sold_out" | "unknown";
};
