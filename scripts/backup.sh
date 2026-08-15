#!/usr/bin/env bash
# Nightly backup: Postgres dump + the /data/uploads archive (tasks.md F4 —
# warehouse photos are the evidence in every damage dispute; losing them is
# the one unrecoverable failure). Keeps the last 14 of each. Wire up via cron
# (see docs/DEPLOY.md). Safe to run any time; read-only against the data.
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

# Warehouse photos (F4). `docker cp` streams the directory as a tar archive,
# so nothing extra is needed inside the container image.
UPLOADS_OUT="$BACKUP_DIR/uploads_${STAMP}.tar.gz"
echo "==> Archiving uploads to $UPLOADS_OUT"
docker cp serviokargo-bot:/data/uploads - | gzip > "$UPLOADS_OUT"

if [ ! -s "$UPLOADS_OUT" ]; then
  echo "ERROR: uploads archive is empty — docker cp failed." >&2
  rm -f "$UPLOADS_OUT"
  exit 1
fi

echo "==> Pruning backups older than 14 days"
find "$BACKUP_DIR" -name 'kargotrack_*.sql.gz' -type f -mtime +14 -delete
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -type f -mtime +14 -delete

echo "==> Backup complete: $OUT + $UPLOADS_OUT"
