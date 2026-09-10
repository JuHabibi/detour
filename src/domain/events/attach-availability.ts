import type {
  EventAvailabilityRecord,
  EventAvailabilityStatus,
} from "@/domain/events/event-availability";
import {
  resolveFreshAvailabilityStatus,
} from "@/domain/events/event-availability";
import type { DetourEvent } from "@/domain/events/event";

/** Attache la disponibilité fraîche (et deep-link) sur un DetourEvent. */
export function attachAvailabilityToEvent(
  event: DetourEvent,
  record: EventAvailabilityRecord | null | undefined,
  now: Date = new Date(),
): DetourEvent {
  if (!record) {
    return {
      ...event,
      availabilityStatus: "unknown",
      availabilityCheckedAt: null,
      availabilityProvider: null,
      bookingUrl: null,
    };
  }

  const status = resolveFreshAvailabilityStatus({
    status: record.status,
    checkedAt: record.checkedAt,
    now,
  });

  const fresh = status !== "unknown";

  return {
    ...event,
    availabilityStatus: status,
    availabilityCheckedAt: record.checkedAt.toISOString(),
    availabilityProvider: record.provider,
    bookingUrl:
      fresh && record.providerEventUrl ? record.providerEventUrl : null,
  };
}

export function effectiveAvailabilityStatus(
  event: DetourEvent,
): EventAvailabilityStatus {
  return event.availabilityStatus ?? "unknown";
}
