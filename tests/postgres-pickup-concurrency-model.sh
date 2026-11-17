#!/usr/bin/env bash
set -euo pipefail
# Dos conexiones concurrentes sobre PostgreSQL efimero; nunca Supabase principal.
DB=(psql -h localhost -U postgres -d mwd_integration_test -X -q -t -A -v ON_ERROR_STOP=1)
"${DB[@]}" -c "INSERT INTO mwd_pickup_test.orders VALUES (4,'simulated'); INSERT INTO mwd_pickup_test.codes(order_id,secret,identity_checked) VALUES (4,'DEMO-SECRET',true); INSERT INTO mwd_pickup_test.payouts(order_id) VALUES (4);"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
"${DB[@]}" -c "SELECT mwd_pickup_test.try_code(4,'DEMO-SECRET','00000000-0000-0000-0000-000000000501')" >"$dir/a" &
p1=$!
"${DB[@]}" -c "SELECT mwd_pickup_test.try_code(4,'DEMO-SECRET','00000000-0000-0000-0000-000000000502')" >"$dir/b" &
p2=$!
wait "$p1"
wait "$p2"
accepted="$(grep -h -c '^t$' "$dir/a" "$dir/b" | awk '{s+=$1} END{print s+0}')"
[[ "$accepted" == 1 ]] || { echo "Expected one accepted redemption, got $accepted"; exit 1; }
"${DB[@]}" -c "SELECT CASE WHEN (SELECT status FROM mwd_pickup_test.codes WHERE order_id=4)='consumed' AND (SELECT count(*) FROM mwd_pickup_test.attempts WHERE order_id=4 AND accepted)=1 THEN 'PASS' ELSE 'FAIL' END" | grep -qx PASS
"${DB[@]}" -c "SELECT mwd_pickup_test.finish(4,'00000000-0000-0000-0000-000000000601')" >"$dir/c" 2>"$dir/cerr" &
p3=$!
"${DB[@]}" -c "SELECT mwd_pickup_test.finish(4,'00000000-0000-0000-0000-000000000602')" >"$dir/d" 2>"$dir/derr" &
p4=$!
wait "$p3" || true
wait "$p4" || true
"${DB[@]}" -c "SELECT CASE WHEN (SELECT count(*) FROM mwd_pickup_test.payouts WHERE order_id=4 AND status='sample_completed' AND request_id IN ('00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000602'))=1 THEN 'PASS' ELSE 'FAIL' END" | grep -qx PASS
echo POSTGRES_PICKUP_CONCURRENCY_MODEL_PASS
