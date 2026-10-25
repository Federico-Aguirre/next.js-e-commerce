#!/usr/bin/env bash
set -Eeuo pipefail

configure_postgres_connection() {
  local connection_url="${1:-}"
  if [[ -z "$connection_url" ]]; then
    echo "A PostgreSQL connection URL is required." >&2
    return 2
  fi

  local pgpassfile
  pgpassfile="$(mktemp "${TMPDIR:-/tmp}/ecommerce-pgpass.XXXXXX")"
  chmod 600 "$pgpassfile"

  local -a parts=()
  if ! mapfile -d '' -t parts < <(python3 - "$connection_url" "$pgpassfile" <<'PY'
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

url = urlsplit(sys.argv[1])
if url.scheme not in {"postgres", "postgresql"} or not url.hostname or not url.path.strip("/"):
    raise SystemExit("DATABASE_URL must be a PostgreSQL URI.")

host = url.hostname
port = str(url.port or 5432)
user = unquote(url.username or "")
database = unquote(url.path.lstrip("/"))
password = unquote(url.password or "")
query = parse_qs(url.query)
sslmode = query.get("sslmode", ["prefer"])[0]
sslrootcert = query.get("sslrootcert", [""])[0]

def pgpass_escape(value):
    return value.replace("\\", "\\\\").replace(":", "\\:")

Path(sys.argv[2]).write_text(
    ":".join(pgpass_escape(part) for part in (host, port, database, user, password)) + "\n",
    encoding="utf-8",
)
for value in (host, port, user, database, sslmode, sslrootcert):
    sys.stdout.buffer.write(value.encode("utf-8") + b"\0")
PY
  ); then
    rm -f "$pgpassfile"
    echo "Could not parse the PostgreSQL connection URL." >&2
    return 2
  fi

  if [[ "${#parts[@]}" -lt 6 ]]; then
    rm -f "$pgpassfile"
    echo "Could not read the PostgreSQL connection settings." >&2
    return 2
  fi

  export PGHOST="${parts[0]}"
  export PGPORT="${parts[1]}"
  export PGUSER="${parts[2]}"
  export PGDATABASE="${parts[3]}"
  export PGSSLMODE="${parts[4]}"
  export PGPASSFILE="$pgpassfile"
  if [[ -n "${parts[5]}" ]]; then export PGSSLROOTCERT="${parts[5]}"; fi
}

cleanup_postgres_connection() {
  if [[ -n "${PGPASSFILE:-}" && -f "$PGPASSFILE" ]]; then
    rm -f "$PGPASSFILE"
  fi
}
