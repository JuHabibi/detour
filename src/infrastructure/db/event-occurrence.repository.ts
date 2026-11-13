import type { DetourEvent } from "@/domain/events/event";
import type { DbQueryable } from "@/infrastructure/db/postgres";

const OCCURRENCE_INSERT_CHUNK_SIZE = 1000;

/** Appelé après l’upsert parent, exclusivement dans la même transaction de sync. */
export async function replaceEventOccurrences(
  events: DetourEvent[],
  syncMarker: Date,
  client: DbQueryable,
): Promise<void> {
  const known = events.filter((event) => event.occurrences !== undefined);
  if (known.length === 0) return;

  const ids = known.map((event) => event.id);
  const rows = known.flatMap((event) =>
    event.occurrences!.map((occurrence) => ({
      event_id: event.id,
      start_at: occurrence.startAt,
      end_at: occurrence.endAt,
      all_day: occurrence.allDay,
    })),
  );

  await client.query(
    "DELETE FROM event_occurrences WHERE event_id = ANY($1::text[])",
    [ids],
  );
  for (let offset = 0; offset < rows.length; offset += OCCURRENCE_INSERT_CHUNK_SIZE) {
    await client.query(
      `INSERT INTO event_occurrences (event_id, start_at, end_at, all_day)
       SELECT event_id, start_at, end_at, all_day
       FROM jsonb_to_recordset($1::jsonb) AS occurrence(
         event_id text, start_at timestamptz, end_at timestamptz, all_day boolean
       )`,
      [JSON.stringify(rows.slice(offset, offset + OCCURRENCE_INSERT_CHUNK_SIZE))],
    );
  }
  await client.query(
    "UPDATE events SET occurrences_synced_at = $2 WHERE id = ANY($1::text[])",
    [ids, syncMarker.toISOString()],
  );
}
