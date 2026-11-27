BEGIN;
DO $gate$
DECLARE a uuid; b uuid; code text; req uuid:=gen_random_uuid(); x jsonb; y jsonb; r jsonb; before_a bigint; before_b bigint;
BEGIN
 SELECT user_id,balance_cents INTO a,before_a FROM public.mwd_wallets WHERE balance_cents>=1 ORDER BY user_id LIMIT 1;
 SELECT user_id,account_code,balance_cents INTO b,code,before_b FROM public.mwd_wallets WHERE user_id<>a AND balance_cents<100000000000 ORDER BY user_id LIMIT 1;
 IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Missing fixtures'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 x:=public.mwd_transfer_demo(code,1,req);
 y:=public.mwd_transfer_demo(code,1,req);
 r:=public.mwd_operation_status_demo(req);
 IF x->>'status' IS DISTINCT FROM 'ok' OR y->>'status' IS DISTINCT FROM 'already_processed' OR x->>'operation_id' IS DISTINCT FROM y->>'operation_id' THEN RAISE EXCEPTION 'Transfer retry failure'; END IF;
 IF r->>'status' IS NULL OR r->>'status'='unconfirmed' THEN RAISE EXCEPTION 'Recovery failure'; END IF;
 RESET ROLE;
 IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id=a) IS DISTINCT FROM before_a-1 OR (SELECT balance_cents FROM public.mwd_wallets WHERE user_id=b) IS DISTINCT FROM before_b+1 THEN RAISE EXCEPTION 'Balance mismatch'; END IF;
 IF (SELECT count(*) FROM public.mwd_operations WHERE actor_id=a AND request_id=req)<>1 THEN RAISE EXCEPTION 'Duplicate operation'; END IF;
END $gate$;
ROLLBACK;
