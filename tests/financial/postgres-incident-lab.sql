\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
INSERT INTO actor_policy VALUES ('incidentA','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('incidentA','beneficiary','verified');
SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('incidentA','beneficiary',10000) \gset q_
SELECT accept_quote('incidentA','r1',:'q_quote_id','sandbox-disclosure-v1') AS id \gset o_
RESET ROLE;
SELECT set_config('mwd.test.ref',:'o_id'||'-funding',true);
SET LOCAL ROLE mwd_lab_event_service;
DO $$
DECLARE ref text:=current_setting('mwd.test.ref');
BEGIN
 IF record_verified_event('mock-remittance','evt1',ref,'confirmed','USD',10150)<>'funded' THEN RAISE EXCEPTION 'normal event'; END IF;
 IF record_verified_event('mock-remittance','evt1',ref,'confirmed','USD',10150)<>'duplicate' THEN RAISE EXCEPTION 'duplicate'; END IF;
 IF record_verified_event('mock-remittance','evt2',ref,'failed','USD',10150)<>'manual_review' THEN RAISE EXCEPTION 'contradiction missed'; END IF;
 IF record_verified_event('mock-remittance','evt2',ref,'failed','USD',10150)<>'manual_review' THEN RAISE EXCEPTION 'incident replay'; END IF;
 IF record_verified_event('mock-remittance','evt3','unknown','confirmed','USD',10)<>'manual_review' THEN RAISE EXCEPTION 'unknown missed'; END IF;
 IF record_verified_event('mock-remittance','evt1',ref,'confirmed','USD',1)<>'manual_review' THEN RAISE EXCEPTION 'event id conflict missed'; END IF;
 BEGIN PERFORM apply_verified_event('mock-remittance','evt4',ref,'confirmed','USD',10150); RAISE EXCEPTION 'raw bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
SELECT prepare_authorized('incidentA',:'o_id','payout');
RESET ROLE;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN
 IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'incident dispatch bypass'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF (SELECT sum(incidents) FROM incident_summary)<>3 THEN RAISE EXCEPTION 'incident count'; END IF;
 BEGIN PERFORM count(*) FROM event_incidents; RAISE EXCEPTION 'raw incident access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM journal j JOIN orders o ON o.id=j.order_id WHERE o.actor='incidentA')<>1 THEN RAISE EXCEPTION 'duplicate posting'; END IF;
 IF (SELECT sum(payable) FROM journal j JOIN orders o ON o.id=j.order_id WHERE o.actor='incidentA')<>-10150 THEN RAISE EXCEPTION 'liability changed'; END IF;
 RAISE NOTICE 'incident review and dispatch hold checks passed';
END $$;
ROLLBACK;
