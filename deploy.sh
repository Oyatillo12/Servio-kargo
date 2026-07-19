#!/usr/bin/env bash
# Deploy / update KargoTrack on the VPS. Safe to re-run: named volumes
# (pgdata, uploads, caddy_*) are never removed, so there is no data loss.
#
# Usage:  ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"                       # run from the repo root
COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building images"
$COMPOSE build

echo "==> Starting database"
$COMPOSE up -d postgres
# Wait until Postgres reports healthy before migrating.
until [ "$(docker inspect -f '{{.State.Health.Status}}' kargotrack-postgres 2>/dev/null)" = "healthy" ]; do
  echo "   waiting for postgres..."
  sleep 2
done

echo "==> Running database migrations"
$COMPOSE run --rm bot pnpm --filter @kargotrack/db db:migrate

echo "==> Restarting app services"
$COMPOSE up -d web bot caddy

echo "==> Cleaning up dangling images"
docker image prune -f >/dev/null

echo "==> Done. Live containers:"
$COMPOSE ps
