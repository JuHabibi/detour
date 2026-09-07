-- migrate:up

-- Champs normalisés Explorer (additifs) — ne modifie pas category/city bruts.
ALTER TABLE events
  ADD COLUMN product_category text
    CHECK (
      product_category IS NULL
      OR product_category IN (
        'Musique',
        'Spectacle',
        'Exposition',
        'Atelier',
        'Jeune public',
        'Rencontre',
        'Visite',
        'Fête / salon / marché',
        'Loisirs culturels',
        'Autre'
      )
    ),
  ADD COLUMN city_key text;

CREATE INDEX events_active_start_at_id_idx
  ON events (start_at, id)
  WHERE is_active = true;

CREATE INDEX events_active_product_category_idx
  ON events (product_category)
  WHERE is_active = true;

CREATE INDEX events_active_city_key_idx
  ON events (city_key)
  WHERE is_active = true;

-- migrate:down

DROP INDEX IF EXISTS events_active_city_key_idx;
DROP INDEX IF EXISTS events_active_product_category_idx;
DROP INDEX IF EXISTS events_active_start_at_id_idx;

ALTER TABLE events
  DROP COLUMN IF EXISTS city_key,
  DROP COLUMN IF EXISTS product_category;
