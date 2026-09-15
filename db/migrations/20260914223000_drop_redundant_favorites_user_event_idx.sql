-- migrate:up

-- Redondant avec UNIQUE (user_id, event_id) : même préfixe user_id + lookup (user_id, event_id).
DROP INDEX IF EXISTS favorites_user_id_event_id_idx;

-- migrate:down

CREATE INDEX favorites_user_id_event_id_idx
  ON favorites (user_id, event_id);
