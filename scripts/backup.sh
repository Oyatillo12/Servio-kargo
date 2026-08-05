#!/usr/bin/env bash
# Nightly Postgres backup. Dumps the database with pg_dump inside the running
# postgres container and keeps the last 14 daily dumps. Wire up via cron (see
# docs/DEPLOY.md). Safe to run any time; read-only against the DB.
set -euo pipefail

cd "$(dirname "$0")/.."                     # repo root (holds .env)
set -a; . ./.env; set +a                    # load POSTGRES_* + DB name

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kargotrack}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="$BACKUP_DIR/kargotrack_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "==> Dumping database to $OUT"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" serviokargo-postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner \
  | gzip > "$OUT"

# Fail loudly if the dump is empty/broken rather than silently keeping junk.
if [ ! -s "$OUT" ]; then
  echo "ERROR: backup file is empty — dump failed." >&2
  rm -f "$OUT"
  exit 1
fi

echo "==> Pruning backups older than 14 days"
find "$BACKUP_DIR" -name 'kargotrack_*.sql.gz' -type f -mtime +14 -delete

echo "==> Backup complete: $OUT"
