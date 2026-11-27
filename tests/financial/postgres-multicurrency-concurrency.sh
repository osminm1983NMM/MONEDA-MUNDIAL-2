#!/usr/bin/env bash
# Only the restored disposable CI cluster; no network provider or production access.
set -euo pipefail
db=mwd_financial_sandbox_test
container=${RECOVERY_CONTAINER:?missing disposable recovery cluster}
sql(){ docker exec -i "$container" psql -X -qAt -v ON_ERROR_STOP=1 -U lab -d "$db" "$@"; }
[[ "$(sql -c 'SELECT current_database()')" == "$db" ]]
tmp=$(mktemp -d)
first_pid=''
cleanup(){ if [[ -n "$first_pid" ]]; then wait "$first_pid" || true; fi; rm -rf "$tmp"; }
trap cleanup EXIT
sql <<'SQL'
SET ROLE mwd_lab_multi_order;
SELECT mwd_financial_lab.multi_create('race-multi-a',10000,150,250000);
SELECT mwd_financial_lab.multi_create('race-multi-b',10000,150,250000);
SELECT mwd_financial_lab.multi_create('race-multi-c',10000,150,250000);
SQL
# Start the first transaction, wait for the second session to be actually blocked,
# and only then commit. Both global event-ID and per-order locks are exercised.
race(){
 local first=$1 second=$2 expected=$3 first_expected=$4
 sql -v first="$first" > "$tmp/first" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL ROLE mwd_lab_multi_event;
SELECT :first;
RESET ROLE;
SELECT pg_advisory_xact_lock(60261126,100);
DO $$
BEGIN
 LOOP
  PERFORM pg_stat_clear_snapshot();
  EXIT WHEN EXISTS(SELECT FROM pg_stat_activity WHERE application_name='mwd-multi-race-second' AND pg_backend_pid()=ANY(pg_blocking_pids(pid)));
  PERFORM pg_sleep(0.05);
 END LOOP;
END $$;
COMMIT;
SQL
 first_pid=$!
 local ready=false
 for _ in $(seq 1 60); do
  if [[ "$(sql -c 'SELECT pg_try_advisory_lock(60261126,100)')" == f ]]; then ready=true; break; fi
  sleep 0.1
 done
 [[ "$ready" == true ]] || { cat "$tmp/first"; exit 1; }
 local rc=0
 sql -v second="$second" > "$tmp/second" 2>&1 <<'SQL' || rc=$?
SET application_name='mwd-multi-race-second';
SET statement_timeout='15s';
SET ROLE mwd_lab_multi_event;
SELECT :second;
SQL
 wait "$first_pid" || { cat "$tmp/first"; exit 1; }
 first_pid=''
 grep -qx "$first_expected" "$tmp/first"
 if [[ "$expected" == duplicate ]]; then
  [[ "$rc" == 0 ]] && grep -qx duplicate "$tmp/second"
 else
  [[ "$rc" != 0 ]] && grep -q "ERROR:  $expected" "$tmp/second"
 fi
}
race "mwd_financial_lab.multi_apply('race-multi-a','race-event-1','funding_confirmed',10150,NULL,NULL)" "mwd_financial_lab.multi_apply('race-multi-a','race-event-1','funding_confirmed',10150,NULL,NULL)" duplicate funded
race "mwd_financial_lab.multi_apply('race-multi-b','race-event-2','funding_confirmed',10150,NULL,NULL)" "mwd_financial_lab.multi_apply('race-multi-c','race-event-2','funding_confirmed',10150,NULL,NULL)" EVENT_ID_CONFLICT funded
race "mwd_financial_lab.multi_apply('race-multi-a','race-event-3','fx_acquired',10000,250000,40)" "mwd_financial_lab.multi_apply('race-multi-a','race-event-4','fx_acquired',10000,250000,40)" INVALID_TRANSITION fx_acquired
[[ "$(sql -c "SELECT count(*) FROM mwd_financial_lab.multi_events WHERE id LIKE 'race-event-%'")" == 3 ]]
[[ "$(sql -c "SELECT count(*) FROM mwd_financial_lab.multi_journal WHERE event_id LIKE 'race-event-%'")" == 4 ]]
[[ "$(sql -c "SELECT state FROM mwd_financial_lab.multi_orders WHERE id='race-multi-c'")" == awaiting_funding ]]
[[ "$(sql -c "SELECT state FROM mwd_financial_lab.multi_orders WHERE id='race-multi-a'")" == fx_acquired ]]
echo 'Restored multicurrency ledger serialized identical, conflicting and competing events'
