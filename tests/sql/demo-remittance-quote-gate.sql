-- DEMO only: validate all enabled routes, fee math and owner-data isolation.
BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE q jsonb; countries jsonb; method text; amount bigint; fee bigint; r record; routes jsonb; checked int:=0; route_count int:=0;
BEGIN
 SELECT jsonb_agg(to_jsonb(t)) INTO routes FROM (SELECT destination_country,payout_currency,fee_bps,min_fee_cents FROM mwd_finance_private.demo_fee_routes WHERE origin_country='US' AND simulator_enabled IS TRUE AND real_payments_enabled IS FALSE) t;
 IF routes IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(routes) x WHERE x->>'destination_country'='HN') THEN RAISE EXCEPTION 'Missing Honduras DEMO route'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM FALSE) THEN RAISE EXCEPTION 'Real payment route enabled'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 countries:=public.mwd_world_countries_demo();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(countries) c WHERE c->>'realPaymentsEnabled' IS DISTINCT FROM 'false') THEN RAISE EXCEPTION 'Real payments flag'; END IF;
 FOR r IN SELECT * FROM jsonb_to_recordset(routes) AS x(destination_country text,payout_currency text,fee_bps integer,min_fee_cents bigint) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(countries) c WHERE c->>'code'=r.destination_country AND c->>'demoAvailable'='true') THEN RAISE EXCEPTION 'Missing country catalog route'; END IF;
  FOREACH method IN ARRAY ARRAY['bank','card'] LOOP
   FOREACH amount IN ARRAY ARRAY[100::bigint,10000::bigint,10000000::bigint] LOOP
    q:=public.mwd_quote_international_demo(r.destination_country,amount,method);
    fee:=greatest(r.min_fee_cents,ceil(amount::numeric*r.fee_bps/10000)::bigint);
    IF q->>'status' IS DISTINCT FROM 'simulation_only' OR q->>'realPaymentsEnabled' IS DISTINCT FROM 'false' OR q->>'destination' IS DISTINCT FROM r.destination_country OR q->>'method' IS DISTINCT FROM method OR q->>'destinationCurrency' IS DISTINCT FROM r.payout_currency OR (q->>'amountCents')::bigint IS DISTINCT FROM amount THEN RAISE EXCEPTION 'Invalid quote'; END IF;
    IF (q->>'feeCents')::bigint IS DISTINCT FROM fee OR (q->>'totalPayCents')::bigint IS DISTINCT FROM amount+fee THEN RAISE EXCEPTION 'Fee mismatch'; END IF;
    IF q ? 'costEstimateCents' OR q ? 'illustrativeMarginCents' THEN RAISE EXCEPTION 'Owner data exposed'; END IF;
    IF r.payout_currency='USD' THEN
     IF (q->>'receiverAmountCents')::bigint IS DISTINCT FROM amount OR (q->>'fxRate')::numeric IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Invalid USD payout quote'; END IF;
    ELSE
     IF q->>'fxRate' IS NOT NULL OR q->>'receiverAmountCents' IS NOT NULL THEN RAISE EXCEPTION 'Unexpected non-USD FX quote'; END IF;
    END IF;
    checked:=checked+1;
   END LOOP;
  END LOOP;
  route_count:=route_count+1;
 END LOOP;
 FOREACH amount IN ARRAY ARRAY[0::bigint,99::bigint,10000001::bigint] LOOP
  BEGIN
   PERFORM public.mwd_quote_international_demo('HN',amount,'bank');
   RAISE EXCEPTION 'Invalid amount accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
 END LOOP;
 BEGIN
  PERFORM public.mwd_quote_international_demo('HN',10000,'invalid');
  RAISE EXCEPTION 'Invalid method accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 RESET ROLE;
 IF checked<>route_count*6 OR route_count=0 THEN RAISE EXCEPTION 'Incomplete quote coverage'; END IF;
END $gate$;
SELECT count(*) AS routes_checked,count(*)*6 AS quotes_checked FROM mwd_finance_private.demo_fee_routes WHERE origin_country='US' AND simulator_enabled IS TRUE AND real_payments_enabled IS FALSE;
ROLLBACK;
