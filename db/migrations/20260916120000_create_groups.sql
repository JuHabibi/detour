-- migrate:up

-- Groupes personnels V1 — ownership stricte via user_id.
-- Pas de partage / collab / public.

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groups_name_not_blank CHECK (char_length(btrim(name)) > 0)
);

CREATE INDEX groups_user_id_created_at_idx
  ON groups (user_id, created_at DESC);

CREATE TABLE group_events (
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, event_id)
);

-- Lookup inverse éventuel (event → groupes) sans full scan.
CREATE INDEX group_events_event_id_idx
  ON group_events (event_id);

-- migrate:down

DROP TABLE IF EXISTS group_events;
DROP TABLE IF EXISTS groups;
