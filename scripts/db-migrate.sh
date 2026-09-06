#!/usr/bin/env bash
# Runner migrations via dbmate (PostgreSQL standard, table schema_migrations).
# Prérequis : dbmate installé (ex. brew install dbmate)
# La database doit déjà exister (provisionnée séparément).
# Usage :
#   DATABASE_URL=postgres://... ./scripts/db-migrate.sh up
#   DATABASE_URL=postgres://... ./scripts/db-migrate.sh down
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DBMATE_MIGRATIONS_DIR="$ROOT/db/migrations"
# Une migration = une transaction (défaut Postgres chez dbmate).
export DBMATE_NO_DUMP_SCHEMA=1
# Refuse les migrations hors ordre (version plus ancienne ajoutée après coup).
export DBMATE_STRICT=1

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v dbmate >/dev/null 2>&1; then
  echo "dbmate is required (e.g. brew install dbmate)" >&2
  exit 1
fi

direction="${1:-}"
case "$direction" in
  up)
    # `migrate` = pending only ; n'essaie pas de créer la database.
    dbmate --migrations-dir "$DBMATE_MIGRATIONS_DIR" migrate
    ;;
  down)
    dbmate --migrations-dir "$DBMATE_MIGRATIONS_DIR" down
    ;;
  status)
    dbmate --migrations-dir "$DBMATE_MIGRATIONS_DIR" status
    ;;
  *)
    echo "Usage: $0 up|down|status" >&2
    exit 1
    ;;
esac
