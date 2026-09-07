import type { EventAvailabilityStatus } from "@/domain/events/event-availability";

/**
 * Parse le availabilityStatus événement/ticketing dans le HTML SSR Mapado.
 * Ancre : `"availabilityStatus":"<value>","ticketingCategory"` — pas le catalogue i18n.
 */
export function parseMapadoEventAvailabilityStatus(
  html: string,
): EventAvailabilityStatus | null {
  const match = /"availabilityStatus"\s*:\s*"([^"]+)"\s*,\s*"ticketingCategory"/.exec(
    html,
  );
  if (!match) return null;
  return mapMapadoAvailabilityStatus(match[1]!);
}

export function mapMapadoAvailabilityStatus(
  raw: string,
): EventAvailabilityStatus | null {
  switch (raw) {
    case "onSale":
      return "available";
    case "soldOutOnline":
      return "sold_out_online";
    case "soldOut":
      return "sold_out";
    default:
      return null;
  }
}
