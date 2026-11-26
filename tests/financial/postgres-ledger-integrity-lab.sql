\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TEMP TABLE integrity_baseline AS SELECT * FROM ledger_integrity_summary;
INSERT INTO actor_policy SELECT 'integrity'||g,'verified','clear','allow',50000 FROM generate_series(1,6) g;
INSERT INTO beneficiaries SELECT 'integrity'||g,'beneficiary','verified' FROM generate_series(1,6) g;
DO $$ DECLARE g integer; q uuid; o uuid; ref text;
BEGIN
 FOR g IN 1..6 LOOP
  SELECT quote_id INTO q FROM issue_quote('integrity'||g,'beneficiary',10000);
  o:=accept_quote('integrity'||g,'request',q,'sandbox-disclosure-v1');
  ref:=o::text||'-funding';
  IF g=1 THEN CONTINUE; END IF;
  IF g=2 THEN
   PERFORM record_verified_event('mock-remittance','integrity-fund-'||g,ref,'failed','USD',10150);
   CONTINUE;
  END IF;
  PERFORM record_verified_event('mock-remittance','integrity-fund-'||g,ref,'confirmed','USD',10150);
  IF g=3 THEN CONTINUE; END IF;
  PERFORM prepare_authorized('integrity'||g,o,'payout');
  IF g=4 THEN
   PERFORM record_verified_event('mock-remittance','integrity-pay-'||g,o::text||'-payout','confirmed','HNL',250000);
  ELSE
   PERFORM record_verified_event('mock-remittance','integrity-pay-'||g,o::text||'-payout','failed','HNL',250000);
   PERFORM prepare_authorized('integrity'||g,o,'refund');
   IF g=5 THEN
    PERFORM record_verified_event('mock-remittance','integrity-refund-'||g,o::text||'-refund','confirmed','USD',10150);
   END IF;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM ledger_integrity_details d JOIN orders o ON o.id=d.order_id
  WHERE o.actor LIKE 'integrity%' AND NOT d.balance_mismatch AND d.invalid_postings=0 AND d.missing_postings=0)<>6
 THEN RAISE EXCEPTION 'valid lifecycle flagged'; END IF;
END $$;
-- Privileged corruption fixtures simulate a broken migration, never accessible to service roles.
-- An internally balanced but incorrect extra journal entry must still be flagged.
INSERT INTO inbox(provider,event_id,reference,outcome,currency,amount_minor)
 SELECT 'mock-remittance','integrity-extra',id::text||'-funding','confirmed','USD',10150 FROM orders WHERE actor='integrity3';
INSERT INTO journal(provider,event_id,order_id,cash,payable,revenue)
 SELECT 'mock-remittance','integrity-extra',id,1,-1,0 FROM orders WHERE actor='integrity3';
-- A confirmed event missing its accounting entry must be detected independently.
INSERT INTO inbox(provider,event_id,reference,outcome,currency,amount_minor)
 SELECT 'mock-remittance','integrity-missing',id::text||'-funding','confirmed','USD',10150 FROM orders WHERE actor='integrity1';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM ledger_integrity_details d JOIN orders o ON o.id=d.order_id
 WHERE o.actor='integrity3' AND d.balance_mismatch AND d.invalid_postings=1)
 THEN RAISE EXCEPTION 'balanced corruption missed'; END IF;
 IF NOT EXISTS(SELECT FROM ledger_integrity_details d JOIN orders o ON o.id=d.order_id
 WHERE o.actor='integrity1' AND d.missing_postings=1)
 THEN RAISE EXCEPTION 'missing posting missed'; END IF;
 IF (SELECT orders_with_anomalies FROM ledger_integrity_summary)<>(SELECT orders_with_anomalies+2 FROM integrity_baseline)
 THEN RAISE EXCEPTION 'aggregate anomaly count mismatch'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 PERFORM orders_checked FROM ledger_integrity_summary;
 BEGIN PERFORM order_id FROM ledger_integrity_details; RAISE EXCEPTION 'raw order IDs exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
DO $$ BEGIN
 BEGIN PERFORM orders_checked FROM ledger_integrity_summary; RAISE EXCEPTION 'audit summary exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
