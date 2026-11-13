-- migrate:up

-- NULL = calendrier inconnu. Non NULL + aucune ligne = calendrier explicitement vide.
ALTER TABLE events ADD COLUMN occurrences_synced_at timestamptz;

CREATE TABLE event_occurrences (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL CHECK (isfinite(start_at)),
  end_at timestamptz NOT NULL CHECK (isfinite(end_at)),
  all_day boolean NOT NULL DEFAULT false,
  PRIMARY KEY (event_id, start_at, end_at),
  CHECK (end_at >= start_at),
  CHECK (NOT all_day OR end_at > start_at)
);

CREATE INDEX event_occurrences_start_at_event_id_idx
  ON event_occurrences (start_at, event_id);

-- migrate:down

DROP TABLE event_occurrences;
ALTER TABLE events DROP COLUMN occurrences_synced_at;
