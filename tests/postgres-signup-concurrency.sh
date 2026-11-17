#!/usr/bin/env bash
set -euo pipefail
export PGHOST=localhost PGUSER=postgres PGDATABASE=mwd_integration_test
# The main integration script already provisions schema and one synthetic user.
# Two concurrent connections race to create the same user UUID.
ID=00000000-0000-0000-0000-000000000009
TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT
for i in 1 2; do
  (psql -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users(id) VALUES ('$ID');" >"$TMPDIR_TEST/$i.out" 2>"$TMPDIR_TEST/$i.err" && echo ok >"$TMPDIR_TEST/$i.status" || echo failed >"$TMPDIR_TEST/$i.status") &
done
wait
successes=$(grep -l '^ok$' "$TMPDIR_TEST"/*.status | wc -l | tr -d ' ')
if [ "$successes" -ne 1 ]; then echo "Expected exactly one concurrent signup success; got $successes"; cat "$TMPDIR_TEST"/*.err; exit 1; fi
psql -v ON_ERROR_STOP=1 -v id="$ID" <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM auth.users WHERE id='00000000-0000-0000-0000-000000000009')<>1 THEN RAISE EXCEPTION 'concurrent auth user mismatch'; END IF;
 IF (SELECT count(*) FROM public.mwd_profiles WHERE user_id='00000000-0000-0000-0000-000000000009')<>1 THEN RAISE EXCEPTION 'concurrent profile mismatch'; END IF;
 IF (SELECT count(*) FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000009')<>1 THEN RAISE EXCEPTION 'concurrent wallet mismatch'; END IF;
 IF (SELECT count(*) FROM mwd_finance_private.wallet_opening_entries WHERE wallet_user_id='00000000-0000-0000-0000-000000000009')<>1 THEN RAISE EXCEPTION 'concurrent opening mismatch'; END IF;
END $$;
SQL
echo POSTGRES_CONCURRENT_SIGNUP_PASS
