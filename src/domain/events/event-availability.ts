/** Statuts de disponibilité génériques (indépendants du fournisseur de billetterie). */
export type EventAvailabilityStatus =
  | "available"
  | "sold_out_online"
  | "sold_out"
  | "unknown";

/**
 * Snapshot métier de disponibilité pour un événement.
 * Indépendant du stockage SQL / provider concret.
 */
export type EventAvailabilityRecord = {
  eventId: string;
  status: EventAvailabilityStatus;
  provider: string;
  providerEventUrl: string | null;
  checkedAt: Date;
};

/** Fraîcheur max d’un statut persistant avant de le traiter comme inconnu. */
export const EVENT_AVAILABILITY_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export const EVENT_AVAILABILITY_STATUSES: readonly EventAvailabilityStatus[] = [
  "available",
  "sold_out_online",
  "sold_out",
  "unknown",
] as const;

export function isEventAvailabilityStatus(
  value: string,
): value is EventAvailabilityStatus {
  return (EVENT_AVAILABILITY_STATUSES as readonly string[]).includes(value);
}

/**
 * Lecture métier : ligne absente, status unknown, ou checked_at trop vieux → unknown.
 */
export function resolveFreshAvailabilityStatus(params: {
  status: string | null | undefined;
  checkedAt: Date | string | null | undefined;
  now?: Date;
}): EventAvailabilityStatus {
  if (!params.status || !isEventAvailabilityStatus(params.status)) {
    return "unknown";
  }
  if (params.status === "unknown") return "unknown";

  const checkedAt = toDate(params.checkedAt);
  if (!checkedAt) return "unknown";

  const now = params.now ?? new Date();
  const ageMs = now.getTime() - checkedAt.getTime();
  if (ageMs < 0 || ageMs > EVENT_AVAILABILITY_MAX_AGE_MS) {
    return "unknown";
  }

  return params.status;
}

export function isRadarEligibleAvailability(
  status: EventAvailabilityStatus | null | undefined,
): boolean {
  const resolved = status ?? "unknown";
  return resolved !== "sold_out" && resolved !== "sold_out_online";
}

/** Pastille Explorer — uniquement indisponibilité (jamais « Disponible »). */
export type AvailabilityBadge = "Complet" | "Complet en ligne";

export function resolveAvailabilityBadge(
  status: EventAvailabilityStatus | null | undefined,
): AvailabilityBadge | null {
  if (status === "sold_out") return "Complet";
  if (status === "sold_out_online") return "Complet en ligne";
  return null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
