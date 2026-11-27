\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
INSERT INTO actor_policy VALUES ('recoverA','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('recoverA','beneficiary','verified');
SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('recoverA','beneficiary',10000) \gset q_
SELECT accept_quote('recoverA','r1',:'q_quote_id','sandbox-disclosure-v1') AS id \gset o_
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','recover-fund',:'o_id'||'-funding','confirmed','USD',10150);
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
SELECT prepare_authorized('recoverA',:'o_id','payout');
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','recover-payout',:'o_id'||'-payout','failed','HNL',250000);
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
SELECT prepare_authorized('recoverA',:'o_id','refund');
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','recover-refund-failed',:'o_id'||'-refund','failed','USD',10150);
SELECT record_verified_event('mock-remittance','recover-refund-confirmed',:'o_id'||'-refund','confirmed','USD',10150) AS result \gset r_
RESET ROLE;
SELECT (:'r_result'='manual_review') AS quarantined \gset
\if :quarantined
\else
\quit 1
\endif
SELECT id FROM event_incidents WHERE event_id='recover-refund-confirmed' \gset i_
SELECT set_config('mwd.test.order',:'o_id',true),set_config('mwd.test.incident',:'i_id',true);
DO $$ BEGIN
 IF (SELECT state FROM orders WHERE id=current_setting('mwd.test.order')::uuid)<>'refund_pending' THEN RAISE EXCEPTION 'premature recovery'; END IF;
 IF (SELECT sum(payable) FROM journal WHERE order_id=current_setting('mwd.test.order')::uuid)<>-10150 THEN RAISE EXCEPTION 'liability lost'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'blind refund retry'; END IF; END $$;
RESET ROLE;
SELECT set_config('mwd.test.rows',jsonb_build_array(
 jsonb_build_object('mode','sandbox','reference',:'o_id'||'-funding','kind','funding','currency','USD','amountMinor',10150,'status','confirmed'),
 jsonb_build_object('mode','sandbox','reference',:'o_id'||'-payout','kind','payout','currency','HNL','amountMinor',250000,'status','failed'),
 jsonb_build_object('mode','sandbox','reference',:'o_id'||'-refund','kind','refund','currency','USD','amountMinor',10150,'status','confirmed'))::text,true);
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('recover-wrong',true,jsonb_set(current_setting('mwd.test.rows')::jsonb,'{2,amountMinor}','1')) AS id \gset bad_
RESET ROLE;
SELECT set_config('mwd.test.bad',:'bad_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_refund_recovery(current_setting('mwd.test.order')::uuid,current_setting('mwd.test.incident')::bigint,current_setting('mwd.test.bad')::uuid,'first'); RAISE EXCEPTION 'bad evidence accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REFUND_EVIDENCE_MISMATCH' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('recover-good',true,current_setting('mwd.test.rows')::jsonb) AS id \gset b_
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_proposer;
SELECT propose_refund_recovery(:'o_id',:'i_id',:'b_id','first');
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_approver;
DO $$ DECLARE o uuid:=current_setting('mwd.test.order')::uuid;
BEGIN
 BEGIN PERFORM approve_refund_recovery(o,'first'); RAISE EXCEPTION 'self approval'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SECOND_REVIEWER_REQUIRED' THEN RAISE; END IF; END;
 IF approve_refund_recovery(o,'second')<>'refunded' THEN RAISE EXCEPTION 'recovery failed'; END IF;
 IF approve_refund_recovery(o,'second')<>'duplicate' THEN RAISE EXCEPTION 'replay failed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','recover-refund-confirmed',:'o_id'||'-refund','confirmed','USD',10150) AS result \gset again_
RESET ROLE;
SELECT (:'again_result'='duplicate') AS replay_ok \gset
\if :replay_ok
\else
\quit 1
\endif
DO $$ DECLARE o uuid:=current_setting('mwd.test.order')::uuid;
BEGIN
 IF (SELECT state FROM orders WHERE id=o)<>'refunded' THEN RAISE EXCEPTION 'state mismatch'; END IF;
 IF (SELECT count(*) FROM journal WHERE order_id=o)<>2 OR (SELECT sum(payable) FROM journal WHERE order_id=o)<>0 OR (SELECT sum(cash) FROM journal WHERE order_id=o)<>0 THEN RAISE EXCEPTION 'recovery accounting mismatch'; END IF;
 IF (SELECT count(*) FROM outbox WHERE order_id=o AND kind='refund')<>1 THEN RAISE EXCEPTION 'second refund created'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN IF (SELECT completed FROM refund_recovery_summary)<>1 OR (SELECT orders FROM refund_attention)<>0 THEN RAISE EXCEPTION 'audit mismatch'; END IF; END $$;
RESET ROLE;
ROLLBACK;
