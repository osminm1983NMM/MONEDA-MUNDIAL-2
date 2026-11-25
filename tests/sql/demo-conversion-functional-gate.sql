-- DEMO only. All test mutations rolled back.
BEGIN;
DO $gate$
DECLARE a uuid; q jsonb; c jsonb; r jsonb; asset text; request_id uuid; quote_id uuid;
BEGIN
 SELECT user_id INTO a FROM public.mwd_wallets ORDER BY user_id LIMIT 1;
 IF a IS NULL THEN RAISE EXCEPTION 'Missing demo wallet'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 FOREACH asset IN ARRAY ARRAY['COIN','STABLE'] LOOP
 request_id:=gen_random_uuid();
 q:=public.mwd_conversion_quote_demo(asset,1000000,request_id);
 quote_id:=(q->>'quoteId')::uuid;
 IF q->>'realPaymentsEnabled' IS DISTINCT FROM 'false' OR quote_id IS NULL THEN RAISE EXCEPTION 'Invalid demo quote'; END IF;
 IF public.mwd_conversion_quote_demo(asset,1000000,request_id)->>'quoteId' IS DISTINCT FROM quote_id::text THEN RAISE EXCEPTION 'Quote retry mismatch'; END IF;
 c:=public.mwd_conversion_confirm_demo(quote_id);
 IF c->>'status' IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'Conversion failed'; END IF;
 r:=public.mwd_conversion_confirm_demo(quote_id);
 IF r->>'status' IS DISTINCT FROM 'already_processed' OR r->>'conversionId' IS DISTINCT FROM c->>'conversionId' THEN RAISE EXCEPTION 'Duplicate conversion'; END IF;
 r:=public.mwd_conversion_reconcile_demo(quote_id);
 IF r->>'status' IS DISTINCT FROM 'executed' OR r->>'conversionId' IS DISTINCT FROM c->>'conversionId' THEN RAISE EXCEPTION 'Reconciliation failed'; END IF;
 END LOOP;
 RESET ROLE;
END $gate$;
ROLLBACK;
