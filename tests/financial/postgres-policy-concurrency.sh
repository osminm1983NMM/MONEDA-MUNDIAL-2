#!/usr/bin/env bash
set -euo pipefail

db=mwd_financial_sandbox_test
container=${RECOVERY_CONTAINER:?missing disposable recovery cluster}
sql() { docker exec -i "$container" psql -X -qAt -v ON_ERROR_STOP=1 -U lab -d "$db" "$@"; }
tmp=$(mktemp -d)
first_pid=''
cleanup() {
  if [[ -n "$first_pid" ]]; then wait "$first_pid" || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT

sql <<'SQL' > "$tmp/quotes"
INSERT INTO mwd_financial_lab.actor_policy VALUES ('recovery-limit','verified','clear','allow',15000);
INSERT INTO mwd_financial_lab.beneficiaries VALUES ('recovery-limit','beneficiary','verified');
SET ROLE mwd_lab_order_service;
SELECT quote_id FROM mwd_financial_lab.issue_quote('recovery-limit','beneficiary',10000);
SELECT quote_id FROM mwd_financial_lab.issue_quote('recovery-limit','beneficiary',10000);
SQL
mapfile -t quotes < "$tmp/quotes"
[[ "${#quotes[@]}" == 2 && "${quotes[0]}" != "${quotes[1]}" ]]

# The first acceptance holds its row lock until PostgreSQL reports that the
# second session is actually waiting on it. No sleep-based ordering is needed.
sql -v quote="${quotes[0]}" > "$tmp/first" <<'SQL' &
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL ROLE mwd_lab_order_service;
SELECT mwd_financial_lab.accept_quote('recovery-limit','first',:'quote','sandbox-disclosure-v1');
RESET ROLE;
SELECT pg_advisory_xact_lock(60261126, 99);
DO $$
BEGIN
  LOOP
    PERFORM pg_stat_clear_snapshot();
    EXIT WHEN EXISTS (
      SELECT FROM pg_stat_activity
      WHERE application_name = 'mwd-recovery-limit-second'
        AND pg_backend_pid() = ANY (pg_blocking_pids(pid))
    );
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;
COMMIT;
SQL
first_pid=$!
ready=false
for _ in $(seq 1 40); do
  if [[ "$(sql -c 'SELECT pg_try_advisory_lock(60261126, 99)')" == f ]]; then
    ready=true
    break
  fi
  sleep 0.1
done
[[ "$ready" == true ]]

if sql -v quote="${quotes[1]}" > "$tmp/second" 2>&1 <<'SQL'
SET application_name = 'mwd-recovery-limit-second';
SET statement_timeout = '15s';
SET ROLE mwd_lab_order_service;
SELECT mwd_financial_lab.accept_quote('recovery-limit','second',:'quote','sandbox-disclosure-v1');
SQL
then
  echo 'Concurrent acceptance exceeded the daily limit' >&2
  exit 1
fi
wait "$first_pid"
first_pid=''
if ! grep -q 'ERROR:  DAILY_LIMIT' "$tmp/second"; then
  cat "$tmp/second" >&2
  exit 1
fi
[[ "$(sql -c "SELECT count(*), sum(total_cents) FROM mwd_financial_lab.reservations WHERE actor='recovery-limit'")" == '1|10150' ]]
[[ "$(sql -c "SELECT count(*) FROM mwd_financial_lab.orders o JOIN mwd_financial_lab.outbox x ON x.order_id=o.id WHERE o.actor='recovery-limit' AND x.kind='funding'")" == 1 ]]
echo 'Restored daily limit serialized concurrent reservations and funding intents'
