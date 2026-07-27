#!/usr/bin/env bash
# Deploy / update SERVIO Kargo on the VPS. Safe to re-run: named volumes
# (pgdata, uploads, caddy_*) are never removed, so there is no data loss.
#
# Two modes, same steps otherwise:
#   ./deploy.sh          build the images on this machine, then deploy them
#   ./deploy.sh --pull   pull images already built by CI, then deploy them
#                        (this is what .github/workflows/deploy.yml runs over SSH)
#
# Environment (both modes, all optional):
#   IMAGE_TAG   which image tag to run; CI passes the commit SHA. Default `latest`.
#   DEPLOY_REF  commit to fast-forward this checkout to before deploying, so the
#               compose file / Caddyfile on disk match the images being started.
#               Default: whatever the tracked upstream branch points at.
set -euo pipefail

cd "$(dirname "$0")"                       # run from the repo root
COMPOSE="docker compose -f docker-compose.prod.yml"

MODE=build
case "${1:-}" in
  --pull) MODE=pull ;;
  '') ;;
  *) echo "usage: $0 [--pull]" >&2; exit 2 ;;
esac

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
  echo "==> Syncing code"
  before="$(git rev-parse HEAD)"
  git fetch --prune origin
  # --ff-only, never a merge: the VPS checkout is a mirror, not a place to
  # resolve conflicts. With DEPLOY_REF this lands on exactly the commit CI
  # built, even if newer commits have since landed on the branch. Assigned in
  # two steps because `${DEPLOY_REF:-@{u}}` would trip over the inner braces.
  target="${DEPLOY_REF:-}"
  [ -n "$target" ] || target='@{u}'
  git merge --ff-only "$target"
  after="$(git rev-parse HEAD)"
  if [ "$before" != "$after" ]; then
    echo "==> Code updated ${before:0:7} -> ${after:0:7}; re-running with new version"
    KARGO_DEPLOY_REEXEC=1 exec "$0" "$@"
  fi
fi

if [ "$MODE" = pull ]; then
  # Only web + bot: postgres:16 and caddy:2 are upstream images, and re-pulling
  # them on every deploy would swap the database out from under us unasked.
  echo "==> Pulling images (tag ${IMAGE_TAG:-latest})"
  $COMPOSE pull web bot
else
  echo "==> Building images (tag ${IMAGE_TAG:-latest})"
  $COMPOSE build
fi

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

# -T and </dev/null because `compose run` attaches stdin by default: when this
# script is itself being piped into `bash -s` over SSH (the CI path), an
# attached container would swallow the rest of the script.
echo "==> Running database migrations"
$COMPOSE run --rm -T bot pnpm --filter @kargotrack/db db:migrate </dev/null

echo "==> Restarting app services"
$COMPOSE up -d web bot caddy

# Both services declare a healthcheck in docker-compose.prod.yml. Gate on them
# so a release that starts and immediately falls over fails the deploy (and the
# GitHub Actions job) instead of reporting success and leaving a dead site.
echo "==> Waiting for web and bot to report healthy"
for svc in web bot; do
  cid="$($COMPOSE ps -q "$svc")"
  tries=0
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null)" = "healthy" ]; do
    tries=$((tries + 1))
    if [ "$tries" -ge 90 ]; then
      echo "ERROR: $svc never became healthy (180s). Recent logs:" >&2
      $COMPOSE logs --tail 40 "$svc" >&2
      exit 1
    fi
    sleep 2
  done
  echo "   $svc healthy"
done

# Dangling layers plus, in --pull mode, the previously deployed SHA-tagged
# images — those accumulate one per deploy and would eventually fill the disk.
# `until=168h` keeps the last week so a rollback is still a local `up -d`.
echo "==> Cleaning up old images"
docker image prune -f >/dev/null
docker image prune -af --filter 'until=168h' >/dev/null

echo "==> Done. Live containers:"
$COMPOSE ps
