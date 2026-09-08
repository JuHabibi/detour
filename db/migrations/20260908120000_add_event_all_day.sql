-- migrate:up

-- Flag date-only / journée entière : end_at exclusif pour l'affichage civil.
ALTER TABLE events
  ADD COLUMN all_day boolean NOT NULL DEFAULT false;

-- migrate:down

ALTER TABLE events
  DROP COLUMN IF EXISTS all_day;
