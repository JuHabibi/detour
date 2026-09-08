import type { DetourEvent } from "@/domain/events/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import { mapOrleansEventToDetourEvent } from "./orleans-event.mapper";
import type { OrleansApiResponse, OrleansRawEvent } from "./orleans-event.types";

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
    let expectedTotalCount: number | null = null;

    while (true) {
      const page = await fetchOrleansPage(params.from, params.to, offset);

      if (expectedTotalCount === null) {
        expectedTotalCount = page.total_count;
      } else if (page.total_count !== expectedTotalCount) {
        throw new Error(
          `Orleans incomplete pagination: total_count changed (${expectedTotalCount} → ${page.total_count})`,
        );
      }

      const { results } = page;

      if (offset < expectedTotalCount && results.length === 0) {
        throw new Error(
          "Orleans incomplete pagination: empty page before total_count",
        );
      }

      if (
        results.length < PAGE_SIZE &&
        offset + results.length < expectedTotalCount
      ) {
        throw new Error(
          "Orleans incomplete pagination: short page before total_count",
        );
      }

      for (const rawEvent of results) {
        const mapped = mapOrleansEventToDetourEvent(rawEvent);
        if (mapped) events.push(mapped);
      }

      offset += results.length;

      if (offset > expectedTotalCount) {
        throw new Error(
          "Orleans incomplete pagination: offset exceeded total_count",
        );
      }

      if (offset === expectedTotalCount) {
        return events;
      }
    }
  }
}

async function fetchOrleansPage(
  from: Date,
  to: Date,
  offset: number,
): Promise<OrleansApiResponse> {
  const url = buildOrleansUrl(from, to, offset);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Orleans API error: ${response.status} ${response.statusText}`);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error("Orleans API error: invalid JSON");
  }

  return parseOrleansApiResponse(raw);
}

function parseOrleansApiResponse(raw: unknown): OrleansApiResponse {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Orleans API error: invalid response shape");
  }

  const record = raw as Record<string, unknown>;
  const totalCount = record.total_count;

  if (
    typeof totalCount !== "number" ||
    !Number.isInteger(totalCount) ||
    totalCount < 0
  ) {
    throw new Error("Orleans API error: invalid total_count");
  }

  if (!Array.isArray(record.results)) {
    throw new Error("Orleans API error: invalid results");
  }

  return {
    total_count: totalCount,
    results: record.results as OrleansRawEvent[],
  };
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
    where: buildOrleansWhereClause(fromLiteral, toLiteral),
  });

  return `${BASE_URL}?${searchParams.toString()}`;
}

/** ODS window intersection: start <= to AND ifnull(end, start) >= from. */
export function buildOrleansWhereClause(
  fromLiteral: string,
  toLiteral: string,
): string {
  return [
    `firstdate_begin <= date'${toLiteral}'`,
    `ifnull(firstdate_end, firstdate_begin) >= date'${fromLiteral}'`,
    `statut_evenement = 'à venir'`,
  ].join(" AND ");
}

function toOdsDateLiteral(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}
