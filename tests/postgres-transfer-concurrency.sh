#!/usr/bin/env bash
set -euo pipefail
export PGHOST=localhost PGUSER=postgres PGDATABASE=mwd_integration_test
psql -v ON_ERROR_STOP=1 <<'SQL'
-- Test-only transfer procedure; not the Supabase production implementation.
CREATE TABLE public.test_transfer_operations(request_id uuid PRIMARY KEY, sender uuid NOT NULL, recipient uuid NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents>0));
CREATE FUNCTION public.test_atomic_transfer(p_request uuid,p_sender uuid,p_recipient uuid,p_amount bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE balance bigint;
BEGIN
 IF p_amount<=0 OR p_sender=p_recipient THEN RAISE EXCEPTION 'invalid transfer'; END IF;
 IF EXISTS(SELECT 1 FROM public.test_transfer_operations WHERE request_id=p_request) THEN RETURN; END IF;
 -- Consistent order avoids opposite-direction deadlocks.
 PERFORM 1 FROM public.mwd_wallets WHERE user_id IN(p_sender,p_recipient) ORDER BY user_id FOR UPDATE;
 IF (SELECT count(*) FROM public.mwd_wallets WHERE user_id IN(p_sender,p_recipient))<>2 THEN RAISE EXCEPTION 'wallet missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.test_transfer_operations WHERE request_id=p_request) THEN RETURN; END IF;
 SELECT balance_cents INTO balance FROM public.mwd_wallets WHERE user_id=p_sender;
 IF balance<p_amount THEN RAISE EXCEPTION 'insufficient funds'; END IF;
 UPDATE public.mwd_wallets SET balance_cents=balance_cents-p_amount WHERE user_id=p_sender;
 UPDATE public.mwd_wallets SET balance_cents=balance_cents+p_amount WHERE user_id=p_recipient;
 INSERT INTO public.test_transfer_operations VALUES(p_request,p_sender,p_recipient,p_amount);
END $$;
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000020'),('00000000-0000-0000-0000-000000000021'),('00000000-0000-0000-0000-000000000022');
-- Sender has 1,000,000 cents; each request asks for 700,000, so only one can succeed.
SQL
DIR=$(mktemp -d); trap 'rm -rf "$DIR"' EXIT
for n in 1 2; do
 (psql -v ON_ERROR_STOP=1 -c "SELECT public.test_atomic_transfer('00000000-0000-0000-0000-00000000003$n','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-00000000002$n',700000);" >"$DIR/$n.out" 2>"$DIR/$n.err" && echo ok >"$DIR/$n.status" || echo failed >"$DIR/$n.status") &
done
wait
s=$(grep -l '^ok$' "$DIR"/*.status | wc -l | tr -d ' ')
if [ "$s" -ne 1 ]; then echo "Expected one transfer success, got $s"; cat "$DIR"/*.err; exit 1; fi
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ DECLARE total bigint; BEGIN
 SELECT sum(balance_cents) INTO total FROM public.mwd_wallets WHERE user_id IN ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000022');
 IF total<>3000000 THEN RAISE EXCEPTION 'money conservation violated: %',total; END IF;
 IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000020')<>300000 THEN RAISE EXCEPTION 'sender balance mismatch'; END IF;
 IF (SELECT count(*) FROM public.test_transfer_operations)<>1 THEN RAISE EXCEPTION 'operation count mismatch'; END IF;
END $$;
SQL
# Idempotent replay of whichever transfer succeeded: must not double debit.
req=$(psql -At -c 'SELECT request_id FROM public.test_transfer_operations LIMIT 1')
recipient=$(psql -At -c 'SELECT recipient FROM public.test_transfer_operations LIMIT 1')
psql -v ON_ERROR_STOP=1 -c "SELECT public.test_atomic_transfer('$req','00000000-0000-0000-0000-000000000020','$recipient',700000);"
psql -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000020')<>300000 OR (SELECT count(*) FROM public.test_transfer_operations)<>1 THEN RAISE EXCEPTION 'idempotency failed'; END IF; END \$\$;"
echo POSTGRES_TRANSFER_CONCURRENCY_PASS
