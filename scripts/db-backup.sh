#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/postgres-connection.sh
source "$SCRIPT_DIR/lib/postgres-connection.sh"

: "${DATABASE_URL:?Set DATABASE_URL in the protected environment before backing up.}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/ecommerce-db-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

command -v pg_dump >/dev/null || { echo "pg_dump is required (install PostgreSQL client tools)." >&2; exit 127; }
command -v pg_restore >/dev/null || { echo "pg_restore is required (install PostgreSQL client tools)." >&2; exit 127; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 127; }
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2; exit 2; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="ecommerce-postgres-$timestamp.dump"
backup_path="$BACKUP_DIR/$backup_name"
tmp_path="$(mktemp "$BACKUP_DIR/.ecommerce-postgres-$timestamp.XXXXXX")"
trap 'rm -f "$tmp_path"; cleanup_postgres_connection' EXIT

configure_postgres_connection "$DATABASE_URL"
pg_dump --format=custom --no-owner --no-acl --file="$tmp_path"
pg_restore --list "$tmp_path" >/dev/null

mv "$tmp_path" "$backup_path"
chmod 600 "$backup_path"
(
  cd "$BACKUP_DIR"
  sha256sum "$backup_name" > "$backup_name.sha256"
)
chmod 600 "$backup_path.sha256"

if (( RETENTION_DAYS > 0 )); then
  while IFS= read -r -d '' old_backup; do
    rm -f -- "$old_backup" "$old_backup.sha256"
  done < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ecommerce-postgres-*.dump' \
      -mtime "+$RETENTION_DAYS" -print0
  )
fi

printf 'Backup created and verified: %s\n' "$backup_path"
printf 'Checksum: %s.sha256\n' "$backup_path"
