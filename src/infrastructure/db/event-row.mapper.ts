import type { DetourEvent } from "@/domain/events/event";
import { buildEventNormalizedFields } from "@/application/events/build-event-normalized-fields";

/** Ligne `events` telle que renvoyée par node-postgres. */
export type EventRow = {
  id: string;
  adapter_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  start_at: Date;
  end_at: Date | null;
  all_day?: boolean;
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
  product_category?: string | null;
  city_key?: string | null;
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
    ...(row.all_day ? { allDay: true as const } : {}),
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
 * Valeurs positionnelles pour un upsert (champs event + normalisés + adapter + last_seen).
 * Ordre aligné sur `buildUpsertEventsChunkSql`.
 */
export function detourEventToUpsertValues(
  adapterId: string,
  event: DetourEvent,
  syncMarker: Date,
): unknown[] {
  const normalized = buildEventNormalizedFields(event);
  return [
    event.id,
    adapterId,
    event.title,
    event.description,
    event.imageUrl,
    event.startAt,
    event.endAt,
    Boolean(event.allDay),
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
    normalized.productCategory,
    normalized.cityKey,
    syncMarker.toISOString(),
  ];
}

/** 17 champs bruts + all_day + 2 normalisés + last_seen = 21. */
export const UPSERT_EVENT_PARAM_COUNT = 21;

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
  all_day,
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
  product_category,
  city_key,
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
  all_day = EXCLUDED.all_day,
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
  product_category = EXCLUDED.product_category,
  city_key = EXCLUDED.city_key,
  last_seen_at = EXCLUDED.last_seen_at,
  is_active = true,
  updated_at = now()
`.trim();
}
