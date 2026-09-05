import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import {
  mapSaranIcalEventToDetourEvent,
  saranEventIntersectsWindow,
} from "@/infrastructure/sources/saran/saran-ical.mapper";
import { parseSaranIcal } from "@/infrastructure/sources/saran/saran-ical.parser";

/**
 * Note V1 : `/2026-09` et `/2026-10` renvoient le même calendrier (~82 VEVENT).
 * On fetch l’URL connue puis on filtre côté adapter selon { from, to }.
 */
export const SARAN_ICAL_DEFAULT_URL =
  "https://www.mairie-saran.fr/calendrier/saranical.ics/2026-09";

export type SaranEventAdapterConfig = {
  icalUrl?: string;
  fetchImpl?: typeof fetch;
};

export class SaranEventAdapter implements EventSourceAdapter {
  private readonly icalUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SaranEventAdapterConfig = {}) {
    this.icalUrl = config.icalUrl ?? SARAN_ICAL_DEFAULT_URL;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const response = await this.fetchImpl(this.icalUrl);
    if (!response.ok) {
      throw new Error(
        `Saran iCal error: ${response.status} ${response.statusText}`,
      );
    }

    const body = await response.text();
    const parsed = parseSaranIcal(body);
    const mapped: DetourEvent[] = [];

    for (const raw of parsed) {
      const event = mapSaranIcalEventToDetourEvent(raw);
      if (!event) continue;
      if (!saranEventIntersectsWindow(event, params.from, params.to)) continue;
      mapped.push(event);
    }

    return mapped;
  }
}
