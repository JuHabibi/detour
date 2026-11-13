/**
 * Alias fixes : parent e, dates s. La condition est du SQL interne paramétré.
 * Calendrier absent à la dernière sync : ne pas recycler un snapshot obsolète.
 * NULL (source sans calendrier) conserve la période historique.
 */
export function selectedEventDatesCteSql(condition: string): string {
  return `matching_event_dates AS (
    SELECT e.id AS event_id, s.start_at, s.end_at, s.all_day
    FROM events e
    JOIN event_occurrences s ON s.event_id = e.id
    WHERE e.occurrences_synced_at >= e.last_seen_at AND (${condition})
    UNION ALL
    SELECT e.id AS event_id, s.start_at, s.end_at, s.all_day
    FROM events e
    CROSS JOIN LATERAL (SELECT e.start_at, e.end_at, e.all_day) s
    WHERE e.occurrences_synced_at IS NULL AND (${condition})
  ), selected_event_dates AS (
    SELECT DISTINCT ON (event_id) event_id, start_at, end_at, all_day
    FROM matching_event_dates
    ORDER BY event_id, start_at, end_at
  )`;
}

/** Corrélé par PK event_id, une requête SQL, aucun aller-retour par événement. */
export function eventOccurrencesJsonSql(condition = "true"): string {
  return `CASE
  WHEN e.occurrences_synced_at IS NULL THEN NULL
  WHEN e.occurrences_synced_at < e.last_seen_at THEN '[]'::jsonb
  ELSE COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'startAt', s.start_at, 'endAt', s.end_at, 'allDay', s.all_day
    ) ORDER BY s.start_at, s.end_at)
    FROM event_occurrences s WHERE s.event_id = e.id AND (${condition})
  ), '[]'::jsonb)
END`;
}

export const EVENT_OCCURRENCES_JSON_SQL = eventOccurrencesJsonSql();

/** Fin exclusive + traitement explicite des instants sans durée. Alias s. */
export function scheduleEndAfterSql(bound: string): string {
  return `(COALESCE(s.end_at, s.start_at) > ${bound}
    OR (COALESCE(s.end_at, s.start_at) = s.start_at AND s.start_at >= ${bound}))`;
}
