#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/postgres-connection.sh
source "$SCRIPT_DIR/lib/postgres-connection.sh"

if [[ $# -ne 2 || "$2" != "--confirm" ]]; then
  echo "Usage: RESTORE_DATABASE_URL=... RESTORE_CONFIRM_DATABASE=<exact-db-name> $0 <backup.dump> --confirm" >&2
  exit 2
fi

backup_path="$(cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")"
[[ -f "$backup_path" ]] || { echo "Backup file not found." >&2; exit 2; }
[[ -f "$backup_path.sha256" ]] || { echo "Backup checksum file is missing; refusing to restore." >&2; exit 2; }
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to the intended recovery target.}"
: "${RESTORE_CONFIRM_DATABASE:?Set RESTORE_CONFIRM_DATABASE to the exact target database name.}"

command -v pg_restore >/dev/null || { echo "pg_restore is required (install PostgreSQL client tools)." >&2; exit 127; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 127; }

configure_postgres_connection "$RESTORE_DATABASE_URL"
trap 'cleanup_postgres_connection' EXIT

if [[ "$RESTORE_CONFIRM_DATABASE" != "$PGDATABASE" ]]; then
  echo "Confirmation does not match the target database name; restore cancelled." >&2
  exit 2
fi

(
  cd "$(dirname "$backup_path")"
  sha256sum -c "$(basename "$backup_path").sha256"
)
pg_restore --list "$backup_path" >/dev/null

printf "Restoring into PostgreSQL database '%s'. Existing objects in this target will be replaced.\n" "$PGDATABASE"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --single-transaction \
  --dbname="$PGDATABASE" \
  "$backup_path"

printf "Restore completed. Run the post-restore checks in ai/doc/operations-backup-restore.md.\n"
