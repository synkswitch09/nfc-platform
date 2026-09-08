#!/bin/sh
set -eu

backup_path=${1:?Usage: scripts/verify-backup.sh /path/to/tapkind-backup}
cd "$backup_path"
sha256sum -c SHA256SUMS
docker run --rm -i postgres:17-alpine pg_restore --list < database.dump > /dev/null
tar -tzf product_uploads.tar.gz > /dev/null
echo "Checksums, PostgreSQL archive and media archive are readable. Complete a staging restore before calling this backup tested."
