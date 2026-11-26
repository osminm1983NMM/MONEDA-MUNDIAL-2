\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
-- All fixtures are synthetic and rolled back.
CREATE TEMP TABLE monitor_baseline AS SELECT kind,reason,operations,total_minor FROM dispatch_attention;
INSERT INTO actor_policy SELECT 'monitor'||g,'verified','clear','allow',50000 FROM generate_series(1,7) g;
INSERT INTO beneficiaries SELECT 'monitor'||g,'beneficiary','verified' FROM generate_series(1,7) g;
DO $$ DECLARE g integer; q uuid; o uuid; ref text;
BEGIN
 FOR g IN 1..7 LOOP
  SELECT quote_id INTO q FROM issue_quote('monitor'||g,'beneficiary',10000);
  o:=accept_quote('monitor'||g,'request',q,'sandbox-disclosure-v1');
  ref:=o::text||'-funding';
  IF g=2 THEN
   UPDATE dispatch SET queued_at=clock_timestamp()-interval '10 minutes' WHERE reference=ref;
  ELSIF g IN (3,4,5,7) THEN
   UPDATE dispatch SET state='leased',token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '2 minutes',attempts=1 WHERE reference=ref;
   IF g IN (3,4,7) THEN
    PERFORM acknowledge_dispatch(ref,(SELECT token FROM dispatch WHERE reference=ref));
   END IF;
   IF g=4 THEN
    UPDATE dispatch SET acknowledged_at=clock_timestamp()-interval '10 minutes',
      queued_at=clock_timestamp()-interval '11 minutes' WHERE reference=ref;
   ELSIF g=5 THEN
    UPDATE dispatch SET lease_until=clock_timestamp()-interval '1 second' WHERE reference=ref;
   ELSIF g=7 THEN
    IF record_verified_event('mock-remittance','monitor-confirmed',ref,'confirmed','USD',10150)<>'funded'
      THEN RAISE EXCEPTION 'terminal fixture failed'; END IF;
   END IF;
  ELSIF g=6 THEN
   UPDATE actor_policy SET risk='block' WHERE actor='monitor6';
  END IF;
 END LOOP;
END $$;
-- Record a conflict on the queued order; incident takes priority over routine aging.
SELECT record_verified_event('mock-remittance','monitor-conflict',
 (SELECT id::text||'-funding' FROM orders WHERE actor='monitor1'),'confirmed','USD',1);
DO $$ DECLARE expected text; delta bigint; amount numeric;
BEGIN
 FOREACH expected IN ARRAY ARRAY['manual_review','queued_overdue','awaiting_provider','provider_overdue','lease_expired','policy_hold'] LOOP
  SELECT coalesce((SELECT operations FROM dispatch_attention WHERE kind='funding' AND reason=expected),0)-
         coalesce((SELECT operations FROM monitor_baseline WHERE kind='funding' AND reason=expected),0),
         coalesce((SELECT total_minor FROM dispatch_attention WHERE kind='funding' AND reason=expected),0)-
         coalesce((SELECT total_minor FROM monitor_baseline WHERE kind='funding' AND reason=expected),0)
  INTO delta,amount;
  IF delta<>1 OR amount<>10150 THEN RAISE EXCEPTION 'monitor mismatch for %: %, %',expected,delta,amount; END IF;
 END LOOP;
 IF (SELECT count(*) FROM journal j JOIN orders o ON o.id=j.order_id WHERE o.actor LIKE 'monitor%')<>1
 THEN RAISE EXCEPTION 'monitor or acknowledgement altered ledger'; END IF;
 IF NOT EXISTS(SELECT FROM dispatch d JOIN outbox x ON x.reference=d.reference JOIN orders o ON o.id=x.order_id
 WHERE o.actor='monitor3' AND d.state='acknowledged' AND d.acknowledged_at IS NOT NULL AND o.state='funding_pending')
 THEN RAISE EXCEPTION 'acknowledgement not distinct from settlement'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 PERFORM count(*) FROM dispatch_attention;
 BEGIN PERFORM count(*) FROM dispatch; RAISE EXCEPTION 'raw dispatch exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
DO $$ BEGIN
 BEGIN PERFORM count(*) FROM dispatch_attention; RAISE EXCEPTION 'monitor exposed to order role'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
