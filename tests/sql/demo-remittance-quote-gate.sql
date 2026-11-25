BEGIN TRANSACTION READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $gate$
DECLARE q jsonb; countries jsonb; method text;
BEGIN
 countries:=public.mwd_world_countries_demo();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(countries) c WHERE c->>'code'='HN' AND c->>'demoAvailable'='true') THEN RAISE EXCEPTION 'Honduras demo unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(countries) c WHERE c->>'realPaymentsEnabled' IS DISTINCT FROM 'false') THEN RAISE EXCEPTION 'Real payments flag'; END IF;
 FOREACH method IN ARRAY ARRAY['bank','card'] LOOP
 q:=public.mwd_quote_international_demo('HN',10000,method);
 IF q->>'status' IS DISTINCT FROM 'simulation_only' OR q->>'realPaymentsEnabled' IS DISTINCT FROM 'false' OR q->>'destination' IS DISTINCT FROM 'HN' OR q->>'method' IS DISTINCT FROM method THEN RAISE EXCEPTION 'Invalid quote'; END IF;
 IF (q->>'totalPayCents')::bigint IS DISTINCT FROM 10000+(q->>'feeCents')::bigint OR (q->>'feeCents')::bigint IS NULL OR (q->>'feeCents')::bigint<0 THEN RAISE EXCEPTION 'Invalid fee'; END IF;
 IF q ? 'costEstimateCents' OR q ? 'illustrativeMarginCents' THEN RAISE EXCEPTION 'Owner data exposed'; END IF;
 END LOOP;
 BEGIN
 PERFORM public.mwd_quote_international_demo('HN',0,'bank');
 RAISE EXCEPTION 'Invalid amount accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
END $gate$;
ROLLBACK;
