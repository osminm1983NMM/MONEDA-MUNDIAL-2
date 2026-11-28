-- CI disposable fixture database only. Never use on shared or hosted data.
BEGIN;
DO $isolation$
BEGIN
 IF current_database() <> 'mwd_demo_isolated' OR
    (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY'
 THEN RAISE EXCEPTION 'DISPOSABLE_DATABASE_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM false)
 THEN RAISE EXCEPTION 'REAL_PAYMENTS_MUST_BE_DISABLED'; END IF;
 IF (SELECT count(*) FROM auth.users) <> 2 OR
    (SELECT count(*) FROM auth.users WHERE ((id='f1a00000-0000-4000-8000-000000000001' AND email='fixture-a@example.invalid') OR (id='f1a00000-0000-4000-8000-000000000002' AND email='fixture-b@example.invalid')) AND coalesce(encrypted_password,'')='') <> 2 OR
    (SELECT count(*) FROM public.mwd_wallets) <> 2 OR
    (SELECT count(*) FROM public.mwd_wallets WHERE user_id IN ('f1a00000-0000-4000-8000-000000000001','f1a00000-0000-4000-8000-000000000002')) <> 2
 THEN RAISE EXCEPTION 'SYNTHETIC_FIXTURES_REQUIRED'; END IF;
END $isolation$;
DO $history$
DECLARE
 a constant uuid:='f1a00000-0000-4000-8000-000000000001';
 b constant uuid:='f1a00000-0000-4000-8000-000000000002';
 q jsonb; r jsonb; expired_id uuid; order_id uuid;
BEGIN
 -- The preceding concurrent scenario must have created a conversion.
 IF NOT EXISTS(SELECT 1 FROM mwd_swap_private.demo_conversions WHERE from_asset='COIN' AND to_asset='STABLE')
 THEN RAISE EXCEPTION 'Missing forward conversion fixture'; END IF;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 q:=public.mwd_conversion_quote_demo('STABLE',1000000,gen_random_uuid());
 IF q->>'realPaymentsEnabled' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Unsafe reverse quote'; END IF;
 r:=public.mwd_conversion_confirm_demo((q->>'quoteId')::uuid);
 IF r->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Missing reverse conversion'; END IF;
 q:=public.mwd_conversion_quote_demo('COIN',1000000,gen_random_uuid());
 IF q->>'realPaymentsEnabled' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Unsafe expiry quote'; END IF;
 expired_id:=(q->>'quoteId')::uuid;
 r:=public.mwd_pickup_create_demo('HN',100,gen_random_uuid());
 IF r->>'status' IS DISTINCT FROM 'created' OR r->>'isFunded' IS DISTINCT FROM 'false' OR r->>'canPayOut' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'Unsafe pickup fixture'; END IF;
 order_id:=(r->>'orderId')::uuid;
 IF public.mwd_pickup_cancel_demo(order_id)->>'status' IS DISTINCT FROM 'cancelled' THEN RAISE EXCEPTION 'Missing cancelled pickup'; END IF;
 RESET ROLE;
 -- Advance only the synthetic quote's fixture timestamps, without waiting
 -- for real time or changing the business function.
 UPDATE mwd_swap_private.demo_quotes SET created_at=clock_timestamp()-interval '10 minutes',expires_at=clock_timestamp()-interval '1 minute'
 WHERE id=expired_id AND user_id=b AND status='quoted';
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing expiry fixture'; END IF;
END $history$;
COMMIT;
