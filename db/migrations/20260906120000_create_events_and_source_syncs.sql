-- migrate:up

CREATE TABLE events (
  id text PRIMARY KEY,
  adapter_id text NOT NULL,
  title text NOT NULL,
  description text NULL,
  image_url text NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NULL,
  venue text NULL,
  city text NULL,
  latitude double precision NULL,
  longitude double precision NULL,
  category text NULL,
  genre text NULL,
  conditions text NULL,
  source text NULL,
  source_url text NULL,
  registration_url text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL
);

CREATE INDEX events_active_start_at_idx
  ON events (start_at)
  WHERE is_active = true;

CREATE INDEX events_adapter_last_seen_idx
  ON events (adapter_id, last_seen_at);

CREATE TABLE source_syncs (
  adapter_id text PRIMARY KEY,
  last_attempt_at timestamptz NULL,
  last_success_at timestamptz NULL,
  status text NULL CHECK (status IN ('ok', 'error')),
  fetched_count integer NOT NULL DEFAULT 0,
  error_code text NULL,
  error_message_safe text NULL,
  sync_lock_token text NULL,
  sync_locked_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (sync_lock_token IS NULL AND sync_locked_until IS NULL)
    OR
    (sync_lock_token IS NOT NULL AND sync_locked_until IS NOT NULL)
  )
);

-- migrate:down

DROP TABLE IF EXISTS source_syncs;
DROP TABLE IF EXISTS events;
