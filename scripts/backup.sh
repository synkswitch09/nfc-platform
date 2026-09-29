#!/bin/sh
set -eu

backup_root=${1:?Usage: scripts/backup.sh /secure/backup/directory}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="$backup_root/tapkin-$timestamp"
mkdir -p "$destination"

docker compose exec -T db pg_dump -U nfc -d nfc_platform --format=custom > "$destination/database.dump"
docker compose exec -T app tar -czf - -C /app/data uploads > "$destination/product_uploads.tar.gz"
sha256sum "$destination/database.dump" "$destination/product_uploads.tar.gz" > "$destination/SHA256SUMS"

echo "Backup created at $destination"
echo "Run scripts/verify-backup.sh '$destination' before rotating older backups."
