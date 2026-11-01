-- migrate:up

-- Élargit la CHECK product_category : ajoute « Cinéma » (additif, pas de backfill).
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_product_category_check;

ALTER TABLE events
  ADD CONSTRAINT events_product_category_check CHECK (
    product_category IS NULL
    OR product_category IN (
      'Musique',
      'Spectacle',
      'Cinéma',
      'Exposition',
      'Atelier',
      'Jeune public',
      'Rencontre',
      'Visite',
      'Fête / salon / marché',
      'Loisirs culturels',
      'Autre'
    )
  );

-- migrate:down

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_product_category_check;

ALTER TABLE events
  ADD CONSTRAINT events_product_category_check CHECK (
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
  );
