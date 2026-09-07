-- migrate:up

CREATE TABLE event_availability (
  event_id text PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  status text NOT NULL
    CHECK (status IN ('available', 'sold_out_online', 'sold_out', 'unknown')),
  provider text NOT NULL,
  provider_event_url text NULL,
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_availability_checked_at_idx
  ON event_availability (checked_at);

-- migrate:down

DROP TABLE IF EXISTS event_availability;
