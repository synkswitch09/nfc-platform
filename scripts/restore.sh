#!/bin/sh
set -eu

backup_path=${1:?Usage: CONFIRM_RESTORE=yes scripts/restore.sh /path/to/tapkin-backup}
if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Restore replaces the current database and media. Re-run with CONFIRM_RESTORE=yes after checking the target."
  exit 1
fi

scripts/verify-backup.sh "$backup_path"
docker compose stop app
docker compose exec -T db dropdb -U nfc --if-exists --force nfc_platform
docker compose exec -T db createdb -U nfc nfc_platform
docker compose exec -T db pg_restore -U nfc -d nfc_platform --clean --if-exists < "$backup_path/database.dump"
docker compose run --rm -T app sh -c 'find /app/data/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -xzf - -C /app/data' < "$backup_path/product_uploads.tar.gz"
docker compose up -d app
echo "Restore completed. Verify /api/health, sign-in, an uploaded image and a known tag before reopening traffic."
