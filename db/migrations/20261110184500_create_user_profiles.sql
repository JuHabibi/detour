-- migrate:up

-- Profil personnalisation V1 — facultatif (1:1 avec "user").
-- Absence de ligne = onboarding jamais traité.
-- Accès V1 uniquement par user_id (PK) — pas d'index secondaire.

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY
    REFERENCES "user" ("id") ON DELETE CASCADE,
  interests text[] NOT NULL DEFAULT '{}',
  availabilities text[] NOT NULL DEFAULT '{}',
  budget text NOT NULL DEFAULT 'any',
  onboarding_status text NOT NULL DEFAULT 'deferred',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_onboarding_status_check
    CHECK (onboarding_status IN ('deferred', 'completed')),
  CONSTRAINT user_profiles_budget_check
    CHECK (budget IN ('free_preferred', 'any')),
  CONSTRAINT user_profiles_interests_check
    CHECK (
      interests <@ ARRAY[
        'Musique',
        'Spectacle',
        'Cinéma',
        'Exposition',
        'Atelier',
        'Jeune public',
        'Rencontre',
        'Visite',
        'Fête / salon / marché',
        'Loisirs culturels'
      ]::text[]
    ),
  CONSTRAINT user_profiles_availabilities_check
    CHECK (
      availabilities <@ ARRAY[
        'weekday-evening',
        'weekend-day',
        'weekend-evening',
        'flexible'
      ]::text[]
    )
);

-- migrate:down

DROP TABLE IF EXISTS user_profiles;
