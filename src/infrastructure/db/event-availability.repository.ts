import type {
  EventAvailabilityRecord,
  EventAvailabilityStatus,
} from "@/domain/events/event-availability";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";

export type EventAvailabilityRow = {
  event_id: string;
  status: string;
  provider: string;
  provider_event_url: string | null;
  checked_at: Date;
};

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

export async function upsertEventAvailability(
  record: {
    eventId: string;
    status: Exclude<EventAvailabilityStatus, "unknown">;
    provider: string;
    providerEventUrl: string | null;
    checkedAt: Date;
  },
  client?: DbQueryable,
): Promise<void> {
  await db(client).query(
    `
INSERT INTO event_availability (
  event_id,
  status,
  provider,
  provider_event_url,
  checked_at,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, now(), now())
ON CONFLICT (event_id) DO UPDATE SET
  status = EXCLUDED.status,
  provider = EXCLUDED.provider,
  provider_event_url = EXCLUDED.provider_event_url,
  checked_at = EXCLUDED.checked_at,
  updated_at = now()
`.trim(),
    [
      record.eventId,
      record.status,
      record.provider,
      record.providerEventUrl,
      record.checkedAt.toISOString(),
    ],
  );
}

export async function listAvailabilityByEventIds(
  eventIds: string[],
  client?: DbQueryable,
): Promise<Map<string, EventAvailabilityRecord>> {
  const map = new Map<string, EventAvailabilityRecord>();
  if (eventIds.length === 0) return map;

  const result = await db(client).query<EventAvailabilityRow>(
    `
SELECT event_id, status, provider, provider_event_url, checked_at
FROM event_availability
WHERE event_id = ANY($1::text[])
`.trim(),
    [eventIds],
  );

  for (const row of result.rows) {
    map.set(row.event_id, {
      eventId: row.event_id,
      status: row.status as EventAvailabilityStatus,
      provider: row.provider,
      providerEventUrl: row.provider_event_url,
      checkedAt: row.checked_at,
    });
  }
  return map;
}
