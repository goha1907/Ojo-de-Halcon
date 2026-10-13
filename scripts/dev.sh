#!/usr/bin/env bash
# Starts everything for local development with one command: `pnpm dev`.
#   1. Postgres in Docker (waits until healthy)
#   2. pending database migrations
#   3. web app (UI + API routes) and the Telegram bot worker, side by side
# Ctrl+C stops both processes. The database container keeps running.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example to .env and fill it in." >&2
  exit 1
fi

echo "▶ database"
docker compose up -d --wait db

echo "▶ migrations"
pnpm --filter @ojo/db migrate:deploy

echo "▶ web (http://localhost:3000) + bot worker — Ctrl+C to stop"
trap 'kill 0' EXIT INT TERM
pnpm dev:web &
pnpm dev:worker &
wait
