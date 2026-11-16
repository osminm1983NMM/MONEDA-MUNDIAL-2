#!/usr/bin/env bash
set -euo pipefail
# Prueba simultánea de la copia de la función REAL SIM- en PostgreSQL efímero.
DB=(psql -h localhost -U postgres -d mwd_integration_test -X -q -t -A -v ON_ERROR_STOP=1)
order_id='00000000-0000-0000-0000-000000000804'
code='SIM-0123456789ABCDEF0123456789ABCDEF'
owner='00000000-0000-0000-0000-000000000901'
"${DB[@]}" -c "INSERT INTO mwd_pickup_private.demo_orders(id,pickup_code_sha256,expires_at) VALUES ('$order_id',encode(extensions.digest('$code','sha256'),'hex'),clock_timestamp()+interval '1 hour');"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
"${DB[@]}" -c "SELECT set_config('request.jwt.claim.sub','$owner',false); SELECT public.mwd_owner_pickup_simulate_demo('$order_id','$code')->>'status';" >"$dir/a" &
p1=$!
"${DB[@]}" -c "SELECT set_config('request.jwt.claim.sub','$owner',false); SELECT public.mwd_owner_pickup_simulate_demo('$order_id','$code')->>'status';" >"$dir/b" &
p2=$!
wait "$p1"
wait "$p2"
successes="$(awk '$0=="simulated_collected" {n++} END {print n+0}' "$dir/a" "$dir/b")"
unavailable="$(awk '$0=="not_available" {n++} END {print n+0}' "$dir/a" "$dir/b")"
[[ "$successes" == 1 && "$unavailable" == 1 ]] || {
  echo "Expected one simulated_collected and one not_available; got $successes / $unavailable"
  cat "$dir/a" "$dir/b"
  exit 1
}
result="$("${DB[@]}" -c "SELECT CASE WHEN (SELECT count(*) FROM mwd_pickup_private.demo_order_events WHERE order_id='$order_id' AND event_kind='simulated_collected')=1 AND (SELECT count(*) FROM mwd_pickup_private.demo_claim_attempts WHERE order_id='$order_id' AND outcome='successful')=1 AND (SELECT status FROM mwd_pickup_private.demo_orders WHERE id='$order_id')='simulated_collected' THEN 'PASS' ELSE 'FAIL' END")"
[[ "$result" == PASS ]] || { echo "Audit consistency failed: $result"; exit 1; }
echo SIM_REAL_FUNCTION_CONCURRENCY_PASS
