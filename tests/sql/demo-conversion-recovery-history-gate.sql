-- DEMO: historical confirmations and expiry. Locks require a read/write transaction;
-- no new quotes or successful first confirmations; rollback even on success.
BEGIN;
SET LOCAL lock_timeout='2s';
DO $gate$
DECLARE q record; a uuid; j jsonb; oid uuid; executed_n int:=0; expired_n int:=0;
BEGIN
 FOR q IN SELECT * FROM mwd_swap_private.demo_quotes WHERE status='executed' OR (status='quoted' AND expires_at<=clock_timestamp()) LOOP
  SELECT id INTO oid FROM mwd_swap_private.demo_conversions WHERE quote_id=q.id;
  PERFORM set_config('request.jwt.claim.sub',q.user_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',q.user_id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  j:=public.mwd_conversion_reconcile_demo(q.id);
  IF j->>'realPaymentsEnabled' IS DISTINCT FROM 'false' OR j->>'quoteId' IS DISTINCT FROM q.id::text OR (j->>'amountOutMicro')::bigint IS DISTINCT FROM q.amount_out_micro THEN RAISE EXCEPTION 'Recovery mismatch'; END IF;
  IF q.status='executed' THEN
   IF oid IS NULL OR j->>'status' IS DISTINCT FROM 'executed' OR j->>'conversionId' IS DISTINCT FROM oid::text THEN RAISE EXCEPTION 'Executed recovery mismatch'; END IF;
   j:=public.mwd_conversion_confirm_demo(q.id);
   IF j->>'status' IS DISTINCT FROM 'already_processed' OR j->>'conversionId' IS DISTINCT FROM oid::text OR j->>'realPaymentsEnabled' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Repeated confirmation mismatch'; END IF;
   executed_n:=executed_n+1;
  ELSE
   IF oid IS NOT NULL OR j->>'status' IS DISTINCT FROM 'expired' OR j->>'conversionId' IS NOT NULL THEN RAISE EXCEPTION 'Expiry recovery mismatch'; END IF;
   BEGIN
    PERFORM public.mwd_conversion_confirm_demo(q.id);
    RAISE EXCEPTION 'Expired quote accepted';
   EXCEPTION WHEN invalid_parameter_value THEN NULL;
   END;
   expired_n:=expired_n+1;
  END IF;
  RESET ROLE;
  SELECT user_id INTO a FROM public.mwd_wallets WHERE user_id<>q.user_id LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'Missing foreign fixture'; END IF;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN
   PERFORM public.mwd_conversion_reconcile_demo(q.id);
   RAISE EXCEPTION 'Foreign reconciliation accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
   PERFORM public.mwd_conversion_confirm_demo(q.id);
   RAISE EXCEPTION 'Foreign confirmation accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RESET ROLE;
 END LOOP;
 IF executed_n=0 OR expired_n=0 THEN RAISE EXCEPTION 'Missing executed or expired fixture'; END IF;
END $gate$;
SELECT count(*) FILTER(WHERE status='executed') AS executed_checked,count(*) FILTER(WHERE status='quoted' AND expires_at<=clock_timestamp()) AS expired_checked FROM mwd_swap_private.demo_quotes;
ROLLBACK;
