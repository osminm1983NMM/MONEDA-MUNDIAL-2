\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
INSERT INTO actor_policy VALUES ('reviewA','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('reviewA','beneficiary','verified');
SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('reviewA','beneficiary',10000) \gset q_
SELECT accept_quote('reviewA','r1',:'q_quote_id','sandbox-disclosure-v1') AS id \gset o_
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','review-fund',:'o_id'||'-funding','confirmed','USD',10150);
SELECT record_verified_event('mock-remittance','review-contradiction',:'o_id'||'-funding','failed','USD',10150);
RESET ROLE;
SELECT id FROM event_incidents WHERE event_id='review-contradiction' \gset i_
SELECT set_config('mwd.test.incident',:'i_id',true);
SET LOCAL ROLE mwd_lab_order_service;
SELECT prepare_authorized('reviewA',:'o_id','payout');
RESET ROLE;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'unreviewed incident bypass'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_approver;
DO $$ BEGIN
 BEGIN PERFORM approve_review(current_setting('mwd.test.incident')::bigint,'second','synthetic-proof1'); RAISE EXCEPTION 'approval without proposal'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PROPOSAL_REQUIRED' THEN RAISE; END IF; END;
 BEGIN PERFORM propose_review(current_setting('mwd.test.incident')::bigint,'second','synthetic-proof1'); RAISE EXCEPTION 'approver can propose'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 IF propose_review(current_setting('mwd.test.incident')::bigint,'first','synthetic-proof1')<>'proposed' THEN RAISE EXCEPTION 'proposal failed'; END IF;
 IF propose_review(current_setting('mwd.test.incident')::bigint,'first','synthetic-proof1')<>'duplicate' THEN RAISE EXCEPTION 'proposal replay'; END IF;
 BEGIN PERFORM approve_review(current_setting('mwd.test.incident')::bigint,'second','synthetic-proof1'); RAISE EXCEPTION 'proposer can approve'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'proposal alone lifted hold'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_approver;
DO $$ DECLARE n bigint:=current_setting('mwd.test.incident')::bigint;
BEGIN
 BEGIN PERFORM approve_review(n,'first','synthetic-proof1'); RAISE EXCEPTION 'self approval'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SECOND_REVIEWER_REQUIRED' THEN RAISE; END IF; END;
 BEGIN PERFORM approve_review(n,'second','synthetic-other'); RAISE EXCEPTION 'wrong evidence'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_MISMATCH' THEN RAISE; END IF; END;
 IF approve_review(n,'second','synthetic-proof1')<>'approved' THEN RAISE EXCEPTION 'approval failed'; END IF;
 IF approve_review(n,'second','synthetic-proof1')<>'duplicate' THEN RAISE EXCEPTION 'approval replay'; END IF;
 BEGIN DELETE FROM review_approvals; RAISE EXCEPTION 'approval delete'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_dispatch_service;
SELECT reference FROM claim_dispatch(30) \gset lease_
RESET ROLE;
SELECT (:'lease_reference'=:'o_id'||'-payout') AS correct_lease \gset
\if :correct_lease
\else
\quit 1
\endif
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','review-payout-failed',:'o_id'||'-payout','failed','HNL',250000);
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
SELECT prepare_authorized('reviewA',:'o_id','refund');
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','review-refund-failed',:'o_id'||'-refund','failed','USD',10150);
RESET ROLE;
SELECT id FROM event_incidents WHERE event_id='review-refund-failed' \gset rf_
SELECT set_config('mwd.test.refund_incident',:'rf_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_review(current_setting('mwd.test.refund_incident')::bigint,'first','synthetic-refund'); RAISE EXCEPTION 'failed refund dismissed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ESCALATION_REQUIRED' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'blind refund retry'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF (SELECT orders FROM refund_attention)<>1 OR (SELECT outstanding_cents FROM refund_attention)<>10150 THEN RAISE EXCEPTION 'refund exposure missing'; END IF;
 IF (SELECT sum(approved_incidents) FROM review_summary)<>1 OR (SELECT sum(open_incidents) FROM review_summary)<>1 THEN RAISE EXCEPTION 'review counts'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM journal j JOIN orders o ON o.id=j.order_id WHERE o.actor='reviewA')<>1 THEN RAISE EXCEPTION 'review or failed refund altered accounting'; END IF;
 IF (SELECT sum(payable) FROM journal j JOIN orders o ON o.id=j.order_id WHERE o.actor='reviewA')<>-10150 THEN RAISE EXCEPTION 'liability lost'; END IF;
 RAISE NOTICE 'two-role review and failed-refund escalation checks passed';
END $$;
ROLLBACK;
