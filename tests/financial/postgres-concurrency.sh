#!/usr/bin/env bash
set -euo pipefail
: "${LAB_CONTAINER:?LAB_CONTAINER required}"
db=mwd_financial_sandbox_test
sql() { docker exec -i "$LAB_CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U lab -d "$db" "$@"; }
[[ "$(sql -c 'select current_database()')" == "$db" ]]
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# Distinct sessions; first holds a row lock while second replays the same request.
sql > "$tmp/order1" <<'SQL' &
BEGIN;
SET LOCAL ROLE mwd_lab_order_service;
SELECT mwd_financial_lab.create_order('parallel','req','quote','synthetic',10000);
SELECT pg_sleep(2);
COMMIT;
SQL
p1=$!
sleep 0.25
sql > "$tmp/order2" <<'SQL' &
SET ROLE mwd_lab_order_service;
SELECT mwd_financial_lab.create_order('parallel','req','quote','synthetic',10000);
SQL
p2=$!
wait "$p1"; wait "$p2"
id1=$(grep -E '^[0-9a-f-]{36}$' "$tmp/order1")
id2=$(grep -E '^[0-9a-f-]{36}$' "$tmp/order2")
[[ "$id1" == "$id2" ]]
[[ "$(sql -c 'select count(*) from mwd_financial_lab.orders')" == 1 ]]
[[ "$(sql -c 'select count(*) from mwd_financial_lab.outbox')" == 1 ]]
# Both workers compete for the same row; an uncommitted lease must be skipped.
sql > "$tmp/claim1" <<'SQL' &
BEGIN;
SET LOCAL ROLE mwd_lab_dispatch_service;
SELECT reference FROM mwd_financial_lab.claim_dispatch(60);
SELECT pg_sleep(2);
COMMIT;
SQL
p1=$!
sleep 0.25
sql > "$tmp/claim2" <<'SQL' &
SET ROLE mwd_lab_dispatch_service;
SELECT reference FROM mwd_financial_lab.claim_dispatch(60);
SQL
p2=$!
wait "$p1"; wait "$p2"
[[ "$(cat "$tmp/claim1" "$tmp/claim2" | grep -c -E '^[0-9a-f-]{36}-funding$')" == 1 ]]
[[ "$(sql -c 'select attempts from mwd_financial_lab.dispatch')" == 1 ]]
# Duplicate verified event concurrently: one posting and a duplicate response.
ref="$id1-funding"
sql -c "SET ROLE mwd_lab_event_service; SELECT mwd_financial_lab.apply_verified_event('mock-remittance','parallel-event','$ref','confirmed','USD',10150);" > "$tmp/event1" &
p1=$!
sql -c "SET ROLE mwd_lab_event_service; SELECT mwd_financial_lab.apply_verified_event('mock-remittance','parallel-event','$ref','confirmed','USD',10150);" > "$tmp/event2" &
p2=$!
wait "$p1"; wait "$p2"
[[ "$(cat "$tmp/event1" "$tmp/event2" | sort | tr '\n' ' ')" == "duplicate funded " ]]
[[ "$(sql -c 'select count(*) from mwd_financial_lab.journal')" == 1 ]]
[[ "$(sql -c 'select count(*) from mwd_financial_lab.inbox')" == 1 ]]
[[ "$(sql -c 'select sum(payable) from mwd_financial_lab.journal')" == -10150 ]]
echo "Concurrent order, lease and event checks passed"
