-- migrate:up
-- Table Better Auth 1.7.4 (`rateLimit.storage: "database"`).
-- lastRequest = epoch ms (bigint) ; prune natif via DELETE WHERE lastRequest < cutoff.
-- Index lastRequest : accélère le nettoyage des compteurs expirés.

CREATE TABLE "rateLimit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" text NOT NULL,
  "count" integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

CREATE UNIQUE INDEX "rateLimit_key_uidx" ON "rateLimit" ("key");
CREATE INDEX "rateLimit_lastRequest_idx" ON "rateLimit" ("lastRequest");

-- migrate:down

DROP TABLE IF EXISTS "rateLimit";
