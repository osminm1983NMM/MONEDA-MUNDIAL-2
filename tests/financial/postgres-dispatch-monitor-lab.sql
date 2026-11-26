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

-- Independent retry budget fixture. No reset/requeue is exposed to service roles.
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
-- Isolate the new fixture from earlier committed disposable tests.
UPDATE dispatch SET attempts=greatest(attempts,3) WHERE state<>'acknowledged';
INSERT INTO actor_policy VALUES ('retryBudget','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('retryBudget','beneficiary','verified');
DO $$ DECLARE q uuid; o uuid; ref text; lease record; previous_token uuid; n integer; baseline bigint;
BEGIN
 SELECT quote_id INTO q FROM issue_quote('retryBudget','beneficiary',10000);
 o:=accept_quote('retryBudget','request',q,'sandbox-disclosure-v1');
 ref:=o::text||'-funding';
 SELECT coalesce(sum(operations),0) INTO baseline FROM dispatch_attention
 WHERE kind='funding' AND reason='retry_budget_exhausted';
 FOR n IN 1..3 LOOP
  SELECT * INTO lease FROM claim_dispatch(30);
  IF NOT FOUND OR lease.reference<>ref OR lease.attempts<>n THEN RAISE EXCEPTION 'retry claim mismatch %',n; END IF;
  IF NOT check_dispatch_lease(ref,lease.token) THEN RAISE EXCEPTION 'fresh lease invalid'; END IF;
  IF previous_token IS NOT NULL THEN
   IF check_dispatch_lease(ref,previous_token) THEN RAISE EXCEPTION 'stale token accepted'; END IF;
   BEGIN
    PERFORM acknowledge_dispatch(ref,previous_token); RAISE EXCEPTION 'stale ack accepted';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'STALE_LEASE' THEN RAISE; END IF; END;
  END IF;
  previous_token:=lease.token;
  UPDATE dispatch SET lease_until=clock_timestamp()-interval '1 second' WHERE reference=ref;
 END LOOP;
 IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'fourth automatic retry allowed'; END IF;
 IF check_dispatch_lease(ref,previous_token) THEN RAISE EXCEPTION 'expired final lease valid'; END IF;
 IF (SELECT coalesce(sum(operations),0) FROM dispatch_attention
 WHERE kind='funding' AND reason='retry_budget_exhausted')<>baseline+1
 THEN RAISE EXCEPTION 'retry exhaustion not visible'; END IF;
 IF (SELECT state FROM orders WHERE id=o)<>'funding_pending' OR EXISTS(SELECT FROM journal WHERE order_id=o)
 THEN RAISE EXCEPTION 'retry exhaustion changed funds'; END IF;
 -- A verified late confirmation remains accepted; no extra dispatch required.
 IF record_verified_event('mock-remittance','retry-budget-confirmed',ref,'confirmed','USD',10150)<>'funded'
 THEN RAISE EXCEPTION 'late confirmation blocked'; END IF;
 IF (SELECT count(*) FROM journal WHERE order_id=o)<>1 THEN RAISE EXCEPTION 'late confirmation posting mismatch'; END IF;
 IF (SELECT coalesce(sum(operations),0) FROM dispatch_attention
 WHERE kind='funding' AND reason='retry_budget_exhausted')<>baseline
 THEN RAISE EXCEPTION 'terminal operation remained in retry alert'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN
 BEGIN UPDATE dispatch SET attempts=0; RAISE EXCEPTION 'retry reset allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
