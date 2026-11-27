-- DEMO: historical pickup privacy, retry and cancellation checks.
-- No new orders. Existing cancelled orders only for own cancellation retry.
BEGIN;
SET LOCAL lock_timeout='2s';
DO $gate$
DECLARE o record; a uuid; j jsonb; n int:=0; cancelled_n int:=0;
BEGIN
 FOR o IN SELECT id,sender_user_id,client_request_id,destination_country,amount_cents,status,expires_at FROM mwd_pickup_private.demo_orders LOOP
  PERFORM set_config('request.jwt.claim.sub',o.sender_user_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',o.sender_user_id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  j:=public.mwd_pickup_create_demo(o.destination_country,o.amount_cents,o.client_request_id);
  IF j->>'status' IS DISTINCT FROM 'already_created' OR j->>'orderId' IS DISTINCT FROM o.id::text OR j->>'pickupCode' IS NOT NULL OR j->>'realPaymentsEnabled' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Pickup retry mismatch'; END IF;
  IF o.status='cancelled' THEN
   j:=public.mwd_pickup_cancel_demo(o.id);
   IF j->>'status' IS DISTINCT FROM 'already_cancelled' THEN RAISE EXCEPTION 'Cancelled retry mismatch'; END IF;
   cancelled_n:=cancelled_n+1;
  END IF;
  RESET ROLE;
  SELECT user_id INTO a FROM public.mwd_wallets WHERE user_id<>o.sender_user_id LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'Missing foreign fixture'; END IF;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  j:=public.mwd_pickup_my_orders_demo();
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(j) x WHERE x->>'orderId'=o.id::text OR x ? 'pickupCode' OR x ? 'pickup_code_sha256') THEN RAISE EXCEPTION 'Foreign order or secret exposed'; END IF;
  BEGIN
   PERFORM public.mwd_pickup_cancel_demo(o.id);
   RAISE EXCEPTION 'Foreign cancellation accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RESET ROLE;
  n:=n+1;
 END LOOP;
 IF n=0 OR cancelled_n=0 THEN RAISE EXCEPTION 'Missing historical fixtures'; END IF;
END $gate$;
SELECT count(*) AS orders_checked,count(*) FILTER(WHERE status='cancelled') AS cancelled_checked FROM mwd_pickup_private.demo_orders;
ROLLBACK;
