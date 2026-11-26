\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TEMP TABLE lifecycle_baseline AS SELECT * FROM lifecycle_integrity_summary;
INSERT INTO actor_policy SELECT 'lifecycle'||g,'verified','clear','allow',50000 FROM generate_series(1,8) g;
INSERT INTO beneficiaries SELECT 'lifecycle'||g,'beneficiary','verified' FROM generate_series(1,8) g;
DO $$ DECLARE g integer; q uuid; o uuid; a text;
BEGIN
 FOR g IN 1..8 LOOP
  a:='lifecycle'||g;
  SELECT quote_id INTO q FROM issue_quote(a,'beneficiary',10000);
  o:=accept_quote(a,'request',q,'sandbox-disclosure-v1');
  IF g=1 THEN CONTINUE; END IF;
  IF g=2 THEN
   PERFORM record_verified_event('mock-remittance','lifecycle-fund-'||g,o::text||'-funding','failed','USD',10150);
   CONTINUE;
  END IF;
  PERFORM record_verified_event('mock-remittance','lifecycle-fund-'||g,o::text||'-funding','confirmed','USD',10150);
  IF g=3 THEN CONTINUE; END IF;
  PERFORM prepare_authorized(a,o,'payout');
  IF g=4 THEN CONTINUE; END IF;
  IF g=5 THEN
   PERFORM record_verified_event('mock-remittance','lifecycle-pay-'||g,o::text||'-payout','confirmed','HNL',250000);
   CONTINUE;
  END IF;
  PERFORM record_verified_event('mock-remittance','lifecycle-pay-'||g,o::text||'-payout','failed','HNL',250000);
  IF g=6 THEN CONTINUE; END IF;
  PERFORM prepare_authorized(a,o,'refund');
  IF g=7 THEN CONTINUE; END IF;
  PERFORM record_verified_event('mock-remittance','lifecycle-refund-'||g,o::text||'-refund','confirmed','USD',10150);
 END LOOP;
 IF (SELECT count(*) FROM lifecycle_integrity_details d JOIN orders o ON o.id=d.order_id
 WHERE o.actor LIKE 'lifecycle%' AND NOT d.reservation_mismatch AND d.intent_mismatches=0 AND d.event_mismatches=0)<>8
 THEN RAISE EXCEPTION 'valid lifecycle flagged'; END IF;
END $$;
-- Privileged fault injection in disposable transaction only.
UPDATE reservations SET total_cents=total_cents+1 WHERE order_id=(SELECT id FROM orders WHERE actor='lifecycle1');
DELETE FROM dispatch WHERE reference=(SELECT id::text||'-funding' FROM orders WHERE actor='lifecycle2');
INSERT INTO inbox(provider,event_id,reference,outcome,currency,amount_minor)
 SELECT 'mock-remittance','lifecycle-extra',id::text||'-funding','failed','USD',10150 FROM orders WHERE actor='lifecycle3';
-- Incorrect state with no financial postings cannot evade event-based audit.
UPDATE orders SET state='funding_failed' WHERE actor='lifecycle4';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM lifecycle_integrity_details d JOIN orders o ON o.id=d.order_id WHERE o.actor='lifecycle1' AND d.reservation_mismatch) THEN RAISE EXCEPTION 'reservation corruption missed'; END IF;
 IF NOT EXISTS(SELECT FROM lifecycle_integrity_details d JOIN orders o ON o.id=d.order_id WHERE o.actor='lifecycle2' AND d.intent_mismatches=1) THEN RAISE EXCEPTION 'missing dispatch missed'; END IF;
 IF NOT EXISTS(SELECT FROM lifecycle_integrity_details d JOIN orders o ON o.id=d.order_id WHERE o.actor='lifecycle3' AND d.event_mismatches=1) THEN RAISE EXCEPTION 'contradictory event missed'; END IF;
 IF NOT EXISTS(SELECT FROM lifecycle_integrity_details d JOIN orders o ON o.id=d.order_id WHERE o.actor='lifecycle4' AND d.event_mismatches>0 AND d.intent_mismatches>0) THEN RAISE EXCEPTION 'incorrect lifecycle missed'; END IF;
 IF (SELECT orders_with_anomalies FROM lifecycle_integrity_summary)<>(SELECT orders_with_anomalies+4 FROM lifecycle_baseline)
 THEN RAISE EXCEPTION 'aggregate anomaly count mismatch'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 PERFORM orders_checked FROM lifecycle_integrity_summary;
 BEGIN PERFORM order_id FROM lifecycle_integrity_details; RAISE EXCEPTION 'private details exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
DO $$ BEGIN
 BEGIN PERFORM orders_checked FROM lifecycle_integrity_summary; RAISE EXCEPTION 'audit exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
