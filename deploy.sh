#!/usr/bin/env bash
# Deploy / update SERVIO Kargo on the VPS. Safe to re-run: named volumes
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

# Pull latest code first. Bash keeps executing the copy of this script already
# loaded in memory, so a pull that changes deploy.sh would otherwise take effect
# only on the *next* run (this is what left an old run hanging on a since-renamed
# container name). Re-exec ourselves once after a real update so the rest of the
# deploy always runs the freshly-pulled version. KARGO_DEPLOY_REEXEC guards
# against an infinite re-exec loop.
if [ -z "${KARGO_DEPLOY_REEXEC:-}" ]; then
  echo "==> Pulling latest code"
  before="$(git rev-parse HEAD)"
  git pull --ff-only
  after="$(git rev-parse HEAD)"
  if [ "$before" != "$after" ]; then
    echo "==> Code updated ${before:0:7} -> ${after:0:7}; re-running with new version"
    KARGO_DEPLOY_REEXEC=1 exec "$0" "$@"
  fi
fi

echo "==> Building images"
$COMPOSE build

echo "==> Starting database"
$COMPOSE up -d postgres

# Wait until Postgres accepts connections, addressing it by compose *service*
# name (not a hardcoded container name) so a rename can never desync this loop.
# pg_isready runs inside the container using its own POSTGRES_* env vars. Fail
# loudly after ~2 min instead of hanging forever if the DB never comes up.
echo "==> Waiting for postgres to accept connections"
tries=0
until $COMPOSE exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "ERROR: postgres did not become ready after 120s. Recent logs:" >&2
    $COMPOSE logs --tail 40 postgres >&2
    exit 1
  fi
  echo "   waiting for postgres... ($tries)"
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
