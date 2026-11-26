\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
INSERT INTO actor_policy VALUES ('evidenceA','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('evidenceA','beneficiary','verified');
SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('evidenceA','beneficiary',10000) \gset q_
SELECT accept_quote('evidenceA','r1',:'q_quote_id','sandbox-disclosure-v1') AS id \gset o_
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','evidence-fund',:'o_id'||'-funding','confirmed','USD',10150);
RESET ROLE;
SELECT set_config('mwd.test.rows',jsonb_build_array(jsonb_build_object('mode','sandbox','reference',:'o_id'||'-funding','kind','funding','currency','USD','amountMinor',10150,'status','confirmed'))::text,true);
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('evidence-before',true,current_setting('mwd.test.rows')::jsonb) AS id \gset before_
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','evidence-conflict',:'o_id'||'-funding','failed','USD',10150);
RESET ROLE;
SELECT id FROM event_incidents WHERE event_id='evidence-conflict' \gset i_
SELECT set_config('mwd.test.incident',:'i_id',true),set_config('mwd.test.before',:'before_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ DECLARE i bigint:=current_setting('mwd.test.incident')::bigint;
BEGIN
 BEGIN PERFORM propose_review(i,'first','synthetic-made-up'); RAISE EXCEPTION 'raw review bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM propose_statement_review(i,'first',gen_random_uuid()); RAISE EXCEPTION 'missing evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
 BEGIN PERFORM propose_statement_review(i,'first',current_setting('mwd.test.before')::uuid); RAISE EXCEPTION 'pre-incident evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('evidence-partial',false,current_setting('mwd.test.rows')::jsonb) AS id \gset partial_
RESET ROLE;
SELECT set_config('mwd.test.partial',:'partial_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_statement_review(current_setting('mwd.test.incident')::bigint,'first',current_setting('mwd.test.partial')::uuid); RAISE EXCEPTION 'partial evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('evidence-wrong',true,jsonb_set(current_setting('mwd.test.rows')::jsonb,'{0,amountMinor}','1')) AS id \gset wrong_
RESET ROLE;
SELECT set_config('mwd.test.wrong',:'wrong_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_statement_review(current_setting('mwd.test.incident')::bigint,'first',current_setting('mwd.test.wrong')::uuid); RAISE EXCEPTION 'mismatch allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_NOT_MATCHED' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('evidence-confirmed',true,current_setting('mwd.test.rows')::jsonb) AS id \gset good_
RESET ROLE;
SELECT set_config('mwd.test.good',:'good_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
SELECT propose_statement_review(:'i_id','first',:'good_id');
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_approver;
DO $$ DECLARE i bigint:=current_setting('mwd.test.incident')::bigint; b uuid:=current_setting('mwd.test.good')::uuid;
BEGIN
 BEGIN PERFORM approve_review(i,'second','synthetic-made-up'); RAISE EXCEPTION 'raw approval bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM approve_statement_review(i,'first',b); RAISE EXCEPTION 'self approval'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SECOND_REVIEWER_REQUIRED' THEN RAISE; END IF; END;
 IF approve_statement_review(i,'second',b)<>'approved' THEN RAISE EXCEPTION 'approval failed'; END IF;
 IF approve_statement_review(i,'second',b)<>'duplicate' THEN RAISE EXCEPTION 'approval replay'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF (SELECT attached FROM review_evidence_summary)<>1 OR (SELECT approved FROM review_evidence_summary)<>1 THEN RAISE EXCEPTION 'evidence audit mismatch'; END IF;
 BEGIN PERFORM count(*) FROM review_evidence; RAISE EXCEPTION 'raw evidence access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Later batch supersedes old evidence for new proposals.
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','evidence-conflict2',:'o_id'||'-funding','failed','USD',10150);
RESET ROLE;
SELECT id FROM event_incidents WHERE event_id='evidence-conflict2' \gset j_
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('evidence-second',true,current_setting('mwd.test.rows')::jsonb) AS id \gset next_
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_proposer;
SELECT propose_statement_review(:'j_id','first',:'next_id');
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement('evidence-newer',true,jsonb_set(current_setting('mwd.test.rows')::jsonb,'{0,status}','"failed"'));
RESET ROLE;
SELECT set_config('mwd.test.j',:'j_id',true),set_config('mwd.test.next',:'next_id',true);
SET LOCAL ROLE mwd_lab_review_approver;
DO $$ BEGIN
 BEGIN PERFORM approve_statement_review(current_setting('mwd.test.j')::bigint,'second',current_setting('mwd.test.next')::uuid); RAISE EXCEPTION 'superseded evidence approved'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM review_approvals)<>1 THEN RAISE EXCEPTION 'unexpected approval'; END IF;
 IF (SELECT count(*) FROM journal j JOIN orders o ON o.id=j.order_id WHERE o.actor='evidenceA')<>1 THEN RAISE EXCEPTION 'review modified journal'; END IF;
 RAISE NOTICE 'statement-backed review gates passed';
END $$;
ROLLBACK;
