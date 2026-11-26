#!/usr/bin/env bash
set -euo pipefail
: "${LAB_CONTAINER:?LAB_CONTAINER required}"
db=mwd_financial_sandbox_test
sql() { docker exec -i "$LAB_CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U lab -d "$db" "$@"; }
[[ "$(sql -c 'select current_database()')" == "$db" ]]
tmp=$(mktemp -d)
writer=''
cleanup() { if [[ -n "$writer" ]]; then wait "$writer" || true; fi; rm -rf "$tmp"; }
trap cleanup EXIT
# All earlier reserved-order fixtures were rolled back. No new financial order is committed here.
[[ "$(sql -c 'select count(*) from mwd_financial_lab.reservations')" == 0 ]]
sql -c "SELECT mwd_financial_lab.halt_dispatch('operator_emergency');"
halt=$(sql -c 'SELECT max(id) FROM mwd_financial_lab.dispatch_halt_events')
batch=$(sql -c "SELECT mwd_financial_lab.import_statement('concurrent-resume-empty',true,'[]'::jsonb)")
[[ "$halt" =~ ^[0-9]+$ && "$batch" =~ ^[0-9a-f-]{36}$ ]]
[[ "$(sql -c "SET ROLE mwd_lab_resume_proposer; SELECT mwd_financial_lab.propose_dispatch_resume($halt,'$batch','first');")" == "proposed" ]]
# Real independent DB session holds a write-compatible lock. Readiness is signaled
# by a separate advisory lock acquired only AFTER the table lock.
sql > "$tmp/writer" <<'SQL' &
BEGIN;
LOCK TABLE mwd_financial_lab.orders IN ROW EXCLUSIVE MODE;
SELECT pg_advisory_xact_lock(60261126,99);
SELECT pg_sleep(6);
ROLLBACK;
SQL
writer=$!
ready=false
for _ in $(seq 1 40); do
  if [[ "$(sql -c 'SELECT pg_try_advisory_lock(60261126,99)')" == f ]]; then ready=true; break; fi
  sleep 0.1
done
[[ "$ready" == true ]]
if sql -c "SET ROLE mwd_lab_resume_approver; SELECT mwd_financial_lab.approve_dispatch_resume($halt,'$batch','second');" > "$tmp/busy" 2>&1; then
  echo 'Unsafe approval during concurrent writer'; exit 1
fi
grep -q 'RESUME_EVIDENCE_BUSY' "$tmp/busy"
[[ "$(sql -c 'SELECT halted FROM mwd_financial_lab.dispatch_control_summary')" == t ]]
[[ "$(sql -c "SELECT count(*) FROM mwd_financial_lab.dispatch_resume_approvals WHERE halt_id=$halt")" == 0 ]]
wait "$writer"; writer=''
# Repeatable read could reuse a snapshot taken before the lock; reject it.
if sql -c "BEGIN ISOLATION LEVEL REPEATABLE READ; SET LOCAL ROLE mwd_lab_resume_approver; SELECT mwd_financial_lab.approve_dispatch_resume($halt,'$batch','second'); COMMIT;" > "$tmp/isolation" 2>&1; then
 echo 'Unsafe isolation level accepted'; exit 1
fi
grep -q 'RESUME_ISOLATION_REQUIRED' "$tmp/isolation"
[[ "$(sql -c "SET ROLE mwd_lab_resume_approver; SELECT mwd_financial_lab.approve_dispatch_resume($halt,'$batch','second');")" == resumed ]]
[[ "$(sql -c 'SELECT halted FROM mwd_financial_lab.dispatch_control_summary')" == f ]]
[[ "$(sql -c "SELECT count(*) FROM mwd_financial_lab.dispatch_resume_approvals WHERE halt_id=$halt")" == 1 ]]
echo 'Concurrent resume exclusion and fresh snapshot verified'
