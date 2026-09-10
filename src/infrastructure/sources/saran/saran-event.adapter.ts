import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import {
  mapSaranIcalEventToDetourEvent,
  saranEventIntersectsWindow,
} from "@/infrastructure/sources/saran/saran-ical.mapper";
import { parseSaranIcal } from "@/infrastructure/sources/saran/saran-ical.parser";
import type { SaranIcalEvent } from "@/infrastructure/sources/saran/saran-ical.types";

/** Base iCal Saran (segment `/YYYY-MM` ajouté selon la fenêtre). */
export const SARAN_ICAL_BASE_URL =
  "https://www.mairie-saran.fr/calendrier/saranical.ics";

const PARIS_TZ = "Europe/Paris";

export type SaranEventAdapterConfig = {
  /**
   * Override d’une URL unique (tests / debug).
   * Sans override : une URL par mois civil Paris couvert par { from, to }.
   */
  icalUrl?: string;
  fetchImpl?: typeof fetch;
};

export function buildSaranIcalUrl(yearMonth: string): string {
  return `${SARAN_ICAL_BASE_URL}/${yearMonth}`;
}

/** `YYYY-MM` en fuseau Europe/Paris. */
export function formatSaranIcalYearMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    throw new Error("Unable to format Saran iCal year-month");
  }
  return `${year}-${month}`;
}

/**
 * Mois civils Paris qui intersectent [from, to) (borne `to` exclusive,
 * alignée sur saranEventIntersectsWindow).
 */
export function saranIcalMonthsForWindow(from: Date, to: Date): string[] {
  const startKey = formatSaranIcalYearMonth(from);
  const endInstant =
    to.getTime() > from.getTime() ? new Date(to.getTime() - 1) : from;
  const endKey = formatSaranIcalYearMonth(endInstant);

  const months: string[] = [];
  let [year, month] = startKey.split("-").map(Number) as [number, number];
  const [endYear, endMonth] = endKey.split("-").map(Number) as [
    number,
    number,
  ];

  for (;;) {
    months.push(
      `${year}-${String(month).padStart(2, "0")}`,
    );
    if (year === endYear && month === endMonth) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (months.length > 48) {
      throw new Error("Saran iCal month window exceeds 48 months");
    }
  }

  return months;
}

export class SaranEventAdapter implements EventSource {
  private readonly icalUrl: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SaranEventAdapterConfig = {}) {
    this.icalUrl = config.icalUrl ?? null;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const urls =
      this.icalUrl !== null
        ? [this.icalUrl]
        : saranIcalMonthsForWindow(params.from, params.to).map(buildSaranIcalUrl);

    const bodies = await Promise.all(
      urls.map(async (url) => {
        const response = await this.fetchImpl(url);
        if (!response.ok) {
          throw new Error(
            `Saran iCal error: ${response.status} ${response.statusText} (${url})`,
          );
        }
        return response.text();
      }),
    );

    const byUid = new Map<string, SaranIcalEvent>();
    for (const body of bodies) {
      for (const raw of parseSaranIcal(body)) {
        if (!byUid.has(raw.uid)) {
          byUid.set(raw.uid, raw);
        }
      }
    }

    const mapped: DetourEvent[] = [];
    for (const raw of byUid.values()) {
      const event = mapSaranIcalEventToDetourEvent(raw);
      if (!event) continue;
      if (!saranEventIntersectsWindow(event, params.from, params.to)) continue;
      mapped.push(event);
    }

    return mapped;
  }
}
