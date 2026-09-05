import type { DetourEvent } from "@/domain/event";
import { INGESTION_CACHE_TTL_SECONDS } from "@/infrastructure/ingestion-cache";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import { mapOrleansEventToDetourEvent } from "./orleans-event.mapper";
import type { OrleansApiResponse } from "./orleans-event.types";

const BASE_URL =
  "https://data.orleans-metropole.fr/api/explore/v2.1/catalog/datasets/agenda-orleans-metropole/records";

const SELECT_FIELDS = [
  "uid",
  "title_fr",
  "description_fr",
  "image",
  "firstdate_begin",
  "firstdate_end",
  "location_name",
  "location_city",
  "location_coordinates",
  "categorie_principale",
  "conditions_fr",
  "originagenda_title",
  "canonicalurl",
  "registration",
  "statut_evenement",
].join(",");

const PAGE_SIZE = 100;

export class OrleansEventAdapter implements EventSourceAdapter {
  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const events: DetourEvent[] = [];
    let offset = 0;
    let totalCount = Number.POSITIVE_INFINITY;

    while (offset < totalCount) {
      const page = await fetchOrleansPage(params.from, params.to, offset);
      totalCount = page.total_count;

      const results = page.results ?? [];
      if (results.length === 0) break;

      for (const rawEvent of results) {
        const mapped = mapOrleansEventToDetourEvent(rawEvent);
        if (mapped) events.push(mapped);
      }

      offset += results.length;
      if (results.length < PAGE_SIZE) break;
    }

    return events;
  }
}

async function fetchOrleansPage(
  from: Date,
  to: Date,
  offset: number,
): Promise<OrleansApiResponse> {
  const url = buildOrleansUrl(from, to, offset);
  const response = await fetch(url, {
    // Aligné sur le TTL d’ingestion — pas de no-store (chemin caché).
    next: { revalidate: INGESTION_CACHE_TTL_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Orleans API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as OrleansApiResponse;
}

function buildOrleansUrl(from: Date, to: Date, offset: number): string {
  const fromLiteral = toOdsDateLiteral(from);
  const toLiteral = toOdsDateLiteral(to);

  const searchParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
    select: SELECT_FIELDS,
    order_by: "firstdate_begin asc",
    timezone: "Europe/Paris",
    where: [
      `firstdate_begin >= date'${fromLiteral}'`,
      `firstdate_begin <= date'${toLiteral}'`,
      `statut_evenement = 'à venir'`,
    ].join(" AND "),
  });

  return `${BASE_URL}?${searchParams.toString()}`;
}

function toOdsDateLiteral(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}
