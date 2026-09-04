import type { DetourEvent } from "@/domain/event";
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
  "statut_evenement",
].join(",");

/** Limite ODS raisonnable pour le premier POC (pas de pagination avancée). */
const RESULT_LIMIT = 100;

export class OrleansEventAdapter implements EventSourceAdapter {
  async fetchUpcomingEvents(params: {
    from: Date;
    to: Date;
  }): Promise<DetourEvent[]> {
    const url = buildOrleansUrl(params.from, params.to);
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Orleans API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OrleansApiResponse;
    const events: DetourEvent[] = [];

    for (const rawEvent of data.results ?? []) {
      const mapped = mapOrleansEventToDetourEvent(rawEvent);
      if (mapped) events.push(mapped);
    }

    return events;
  }
}

function buildOrleansUrl(from: Date, to: Date): string {
  const fromLiteral = toOdsDateLiteral(from);
  const toLiteral = toOdsDateLiteral(to);

  const searchParams = new URLSearchParams({
    limit: String(RESULT_LIMIT),
    select: SELECT_FIELDS,
    order_by: "firstdate_begin asc",
    timezone: "Europe/Paris",
    // Intervalle demandé + événements encore « à venir » côté OpenAgenda.
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
