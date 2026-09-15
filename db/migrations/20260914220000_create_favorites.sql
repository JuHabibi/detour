-- migrate:up

CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

-- UNIQUE (user_id, event_id) couvre déjà lookup (user_id, event_id) et préfixe user_id.
-- Index composite pour list ORDER BY created_at DESC.

CREATE INDEX favorites_user_id_created_at_idx
  ON favorites (user_id, created_at DESC);

-- migrate:down

DROP TABLE IF EXISTS favorites;
