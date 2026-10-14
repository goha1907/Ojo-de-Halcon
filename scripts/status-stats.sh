#!/usr/bin/env bash
# Prints the anonymous tally of statuses and stages seen at the sources
# (which statuses exist, how often, since when). Usage: scripts/status-stats.sh [KIND]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
kind="${1:-}"
where=""
if [[ -n "$kind" ]]; then where="WHERE \"kind\" = '${kind//\'/}'"; fi
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT \"kind\", \"field\", \"value\", \"count\", \"firstSeenAt\"::date AS first_seen, \"lastSeenAt\"::date AS last_seen
   FROM \"StatusObservation\" $where ORDER BY \"kind\", \"field\", \"count\" DESC"
