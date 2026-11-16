#!/usr/bin/env bash
set -euo pipefail
export PGHOST=localhost PGUSER=postgres PGDATABASE=mwd_integration_test
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
for n in 1 2; do
 (psql -v ON_ERROR_STOP=1 -c "SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000040',false); SELECT public.mwd_transfer_demo('MWD-TEST4$n',700000,'00000000-0000-0000-0000-00000000006$n');" >"$D/$n.out" 2>"$D/$n.err" && echo ok >"$D/$n.status" || echo failed >"$D/$n.status") &
done
wait
s=$(grep -l '^ok$' "$D"/*.status | wc -l | tr -d ' ')
if [ "$s" -ne 1 ]; then echo "Expected exactly one successful transfer, got $s"; cat "$D"/*.out "$D"/*.err; exit 1; fi
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000040')<>300000 THEN RAISE EXCEPTION 'sender mismatch'; END IF;
 IF (SELECT sum(balance_cents) FROM public.mwd_wallets WHERE user_id IN ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042'))<>3000000 THEN RAISE EXCEPTION 'money conservation failure'; END IF;
 IF (SELECT count(*) FROM public.mwd_operations WHERE actor_id='00000000-0000-0000-0000-000000000040')<>1 THEN RAISE EXCEPTION 'operation count mismatch'; END IF;
END $$;
SQL
echo POSTGRES_REAL_TRANSFER_CONCURRENCY_PASS
