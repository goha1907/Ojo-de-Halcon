#!/usr/bin/env bash
# Creates the `ojo_test` database in the dev Postgres container (idempotent).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
exists=$(docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='ojo_test'")
if [[ "$exists" != "1" ]]; then
  docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ojo_test"
  echo "created ojo_test"
else
  echo "ojo_test already exists"
fi
