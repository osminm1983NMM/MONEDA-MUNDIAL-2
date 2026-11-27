#!/usr/bin/env bash
set -euo pipefail

db=mwd_financial_sandbox_test
source_container=${LAB_CONTAINER:?missing disposable source cluster}
target_container=${RECOVERY_CONTAINER:?missing disposable recovery cluster}
[[ "$source_container" != "$target_container" ]]

pg() { docker exec -i "$@"; }
sql() {
  local container=$1 user=$2
  shift 2
  pg "$container" psql -X -qAt -v ON_ERROR_STOP=1 -U "$user" "$@"
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

snapshot() {
  sql "$1" lab -d "$db" <<'SQL'
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

[[ "$(sql "$source_container" lab -d "$db" -c 'SELECT count(*) FROM mwd_financial_lab.journal')" -gt 0 ]]
[[ "$(sql "$source_container" lab -d "$db" -c 'SELECT count(*) FROM mwd_financial_lab.statement_cut_metadata')" -gt 0 ]]
[[ "$(sql "$target_container" recovery_admin -d postgres -c "SELECT count(*) FROM pg_database WHERE datname = '$db'")" == 0 ]]
[[ "$(sql "$target_container" recovery_admin -d postgres -c "SELECT count(*) FROM pg_roles WHERE rolname = 'lab' OR left(rolname, 8) = 'mwd_lab_'")" == 0 ]]

snapshot "$source_container" > "$tmp/source"
pg "$source_container" pg_dumpall -U lab --roles-only --no-role-passwords > "$tmp/roles.sql"
pg "$source_container" pg_dump -U lab --format=custom "$db" > "$tmp/lab.dump"

# No source database is available during recovery.
docker stop "$source_container" > /dev/null
sql "$target_container" recovery_admin -d postgres < "$tmp/roles.sql"
pg "$target_container" pg_restore --exit-on-error --create -U recovery_admin -d postgres < "$tmp/lab.dump"

sql "$target_container" lab -d "$db" < tests/financial/postgres-final-security-lab.sql
[[ "$(sql "$target_container" lab -d "$db" <<'SQL'
SELECT provider, event_id, reference, outcome, currency, amount_minor
FROM mwd_financial_lab.inbox
WHERE event_id = 'worker-refund-2'
\gset event_
SET ROLE mwd_lab_event_service;
SELECT mwd_financial_lab.record_verified_event(
  :'event_provider', :'event_event_id', :'event_reference',
  :'event_outcome', :'event_currency', :'event_amount_minor'
);
SQL
)" == duplicate ]]
snapshot "$target_container" > "$tmp/restored"
diff -u "$tmp/source" "$tmp/restored"
echo 'Independent restore verified: roles, permissions, financial records, sequences and refund replay'
