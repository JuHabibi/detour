import type { DetourEvent } from "@/domain/event";

/** Ligne `events` telle que renvoyée par node-postgres. */
export type EventRow = {
  id: string;
  adapter_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  start_at: Date;
  end_at: Date | null;
  venue: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  genre: string | null;
  conditions: string | null;
  source: string | null;
  source_url: string | null;
  registration_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_seen_at: Date;
};

export type EventWithAdapter = {
  event: DetourEvent;
  adapterId: string;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** DB row → domaine (sans adapter_id sur DetourEvent). */
export function mapEventRowToDetourEvent(row: EventRow): DetourEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    startAt: toIso(row.start_at),
    endAt: toIsoOrNull(row.end_at),
    venue: row.venue,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    category: row.category,
    genre: row.genre,
    conditions: row.conditions,
    source: row.source,
    sourceUrl: row.source_url,
    registrationUrl: row.registration_url,
  };
}

export function mapEventRowToEventWithAdapter(row: EventRow): EventWithAdapter {
  return {
    event: mapEventRowToDetourEvent(row),
    adapterId: row.adapter_id,
  };
}

/**
 * Valeurs positionnelles pour un upsert (16 champs event + adapter + last_seen).
 * Ordre aligné sur `buildUpsertEventsChunkSql`.
 */
export function detourEventToUpsertValues(
  adapterId: string,
  event: DetourEvent,
  syncMarker: Date,
): unknown[] {
  return [
    event.id,
    adapterId,
    event.title,
    event.description,
    event.imageUrl,
    event.startAt,
    event.endAt,
    event.venue,
    event.city,
    event.latitude,
    event.longitude,
    event.category,
    event.genre,
    event.conditions,
    event.source,
    event.sourceUrl,
    event.registrationUrl,
    syncMarker.toISOString(),
  ];
}


export const UPSERT_EVENT_PARAM_COUNT = 18;


export function buildUpsertEventPlaceholders(rowIndex: number): string {
  const base = rowIndex * UPSERT_EVENT_PARAM_COUNT;
  const slots = Array.from(
    { length: UPSERT_EVENT_PARAM_COUNT },
    (_, i) => `$${base + i + 1}`,
  );
  return `(${slots.join(", ")}, true, now(), now())`;
}

export function buildUpsertEventsChunkSql(eventCount: number): string {
  if (eventCount <= 0) {
    throw new Error("upsert chunk requires at least one event");
  }

  const valuesSql = Array.from({ length: eventCount }, (_, i) =>
    buildUpsertEventPlaceholders(i),
  ).join(",\n");

  return `
INSERT INTO events (
  id,
  adapter_id,
  title,
  description,
  image_url,
  start_at,
  end_at,
  venue,
  city,
  latitude,
  longitude,
  category,
  genre,
  conditions,
  source,
  source_url,
  registration_url,
  last_seen_at,
  is_active,
  created_at,
  updated_at
) VALUES
${valuesSql}
ON CONFLICT (id) DO UPDATE SET
  adapter_id = EXCLUDED.adapter_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  venue = EXCLUDED.venue,
  city = EXCLUDED.city,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  category = EXCLUDED.category,
  genre = EXCLUDED.genre,
  conditions = EXCLUDED.conditions,
  source = EXCLUDED.source,
  source_url = EXCLUDED.source_url,
  registration_url = EXCLUDED.registration_url,
  last_seen_at = EXCLUDED.last_seen_at,
  is_active = true,
  updated_at = now()
`.trim();
}
