#!/usr/bin/env bash
set -euo pipefail

db=mwd_financial_sandbox_test
source_db=mwd_financial_sandbox_backup_source
pg() { docker exec -i "${LAB_CONTAINER:?missing disposable PostgreSQL container}" "$@"; }
sql() { pg psql -X -qAt -v ON_ERROR_STOP=1 -U lab "$@"; }

# This is the last CI step. Retain the original database for comparison and
# restore to a fresh database under the original name, including database ACLs.
[[ "$(sql -d "$db" -c 'SELECT current_database()')" == "$db" ]]
[[ "$(sql -d "$db" -c 'SELECT count(*) FROM mwd_financial_lab.journal')" -gt 0 ]]
[[ "$(sql -d "$db" -c 'SELECT count(*) FROM mwd_financial_lab.statement_cut_metadata')" -gt 0 ]]
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pg pg_dump -U lab --format=custom "$db" > "$tmp/lab.dump"
sql -d postgres -c "ALTER DATABASE $db RENAME TO $source_db"
pg pg_restore --exit-on-error --create -U lab -d postgres < "$tmp/lab.dump"

snapshot() {
  sql -d "$1" <<'SQL'
SELECT format(
  'SELECT %L, count(*), md5(coalesce(string_agg(to_jsonb(t)::text, E''\n'' ORDER BY to_jsonb(t)::text COLLATE "C"), '''')) FROM %I.%I t',
  tablename, schemaname, tablename
)
FROM pg_tables WHERE schemaname = 'mwd_financial_lab'
ORDER BY tablename
\gexec
SELECT format('SELECT %L, last_value, is_called FROM %I.%I', sequencename, schemaname, sequencename)
FROM pg_sequences WHERE schemaname = 'mwd_financial_lab'
ORDER BY sequencename
\gexec
SQL
}

snapshot "$source_db" > "$tmp/source"
snapshot "$db" > "$tmp/restored"
diff -u "$tmp/source" "$tmp/restored"
sql -d "$db" < tests/financial/postgres-final-security-lab.sql
echo 'Restored financial records, sequence state, permissions and integrity verified'
