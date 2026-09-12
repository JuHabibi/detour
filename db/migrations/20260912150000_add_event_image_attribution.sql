-- migrate:up

-- Métadonnées d’attribution image (Commons / licences libres) — génériques.
ALTER TABLE events
  ADD COLUMN image_credit text NULL,
  ADD COLUMN image_license text NULL,
  ADD COLUMN image_source_url text NULL;

-- migrate:down

ALTER TABLE events
  DROP COLUMN IF EXISTS image_credit,
  DROP COLUMN IF EXISTS image_license,
  DROP COLUMN IF EXISTS image_source_url;
