-- Re-run the full legacy recovery fixtures against the stricter cut gates.

-- postgres-review-evidence-lab.sql
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
SELECT import_statement_cut('evidence-before','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(current_setting('mwd.test.rows')::jsonb),current_setting('mwd.test.rows')::jsonb) AS id \gset before_
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
-- Owner creates a legacy incomplete batch to test rejection.
SELECT import_statement('evidence-partial',false,current_setting('mwd.test.rows')::jsonb) AS id \gset partial_
RESET ROLE;
SELECT set_config('mwd.test.partial',:'partial_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_statement_review(current_setting('mwd.test.incident')::bigint,'first',current_setting('mwd.test.partial')::uuid); RAISE EXCEPTION 'partial evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement_cut('evidence-wrong','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(jsonb_set(current_setting('mwd.test.rows')::jsonb,'{0,amountMinor}','1')),jsonb_set(current_setting('mwd.test.rows')::jsonb,'{0,amountMinor}','1')) AS id \gset wrong_
RESET ROLE;
SELECT set_config('mwd.test.wrong',:'wrong_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_statement_review(current_setting('mwd.test.incident')::bigint,'first',current_setting('mwd.test.wrong')::uuid); RAISE EXCEPTION 'mismatch allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_NOT_MATCHED' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT import_statement('evidence-legacy-complete',true,current_setting('mwd.test.rows')::jsonb) AS id \gset legacy_
SELECT set_config('mwd.test.legacy',:'legacy_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_statement_review(current_setting('mwd.test.incident')::bigint,'first',current_setting('mwd.test.legacy')::uuid); RAISE EXCEPTION 'legacy full evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement_cut('evidence-confirmed','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(current_setting('mwd.test.rows')::jsonb),current_setting('mwd.test.rows')::jsonb) AS id \gset good_
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
SELECT import_statement_cut('evidence-second','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(current_setting('mwd.test.rows')::jsonb),current_setting('mwd.test.rows')::jsonb) AS id \gset next_
RESET ROLE;
SET LOCAL ROLE mwd_lab_review_proposer;
SELECT propose_statement_review(:'j_id','first',:'next_id');
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement_cut('evidence-newer','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(jsonb_set(current_setting('mwd.test.rows')::jsonb,'{0,status}','"failed"')),jsonb_set(current_setting('mwd.test.rows')::jsonb,'{0,status}','"failed"'));
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


-- postgres-refund-recovery-lab.sql
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
SELECT import_statement_cut('recover-wrong','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(jsonb_set(current_setting('mwd.test.rows')::jsonb,'{2,amountMinor}','1')),jsonb_set(current_setting('mwd.test.rows')::jsonb,'{2,amountMinor}','1')) AS id \gset bad_
RESET ROLE;
SELECT set_config('mwd.test.bad',:'bad_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_refund_recovery(current_setting('mwd.test.order')::uuid,current_setting('mwd.test.incident')::bigint,current_setting('mwd.test.bad')::uuid,'first'); RAISE EXCEPTION 'bad evidence accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REFUND_EVIDENCE_MISMATCH' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT import_statement('recover-legacy-complete',true,current_setting('mwd.test.rows')::jsonb) AS id \gset legacy_
SELECT set_config('mwd.test.legacy',:'legacy_id',true);
SET LOCAL ROLE mwd_lab_review_proposer;
DO $$ BEGIN
 BEGIN PERFORM propose_refund_recovery(current_setting('mwd.test.order')::uuid,current_setting('mwd.test.incident')::bigint,current_setting('mwd.test.legacy')::uuid,'first'); RAISE EXCEPTION 'legacy refund evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
SELECT import_statement_cut('recover-good','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(current_setting('mwd.test.rows')::jsonb),current_setting('mwd.test.rows')::jsonb) AS id \gset b_
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
-- Completed refund recovery must not permanently block a global emergency resume.
DO $$ DECLARE h bigint; b uuid; o uuid:=current_setting('mwd.test.order')::uuid;
BEGIN
 IF NOT order_integrity_ok(o) THEN RAISE EXCEPTION 'recovered order integrity mismatch'; END IF;
 IF halt_dispatch('operator_emergency')<>'halted' THEN RAISE EXCEPTION 'halt failed'; END IF;
 SELECT max(id) INTO h FROM dispatch_halt_events;
 b:=import_statement_cut('recover-resume','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(current_setting('mwd.test.rows')::jsonb),current_setting('mwd.test.rows')::jsonb);
 IF propose_dispatch_resume(h,b,'resume-first')<>'proposed' THEN RAISE EXCEPTION 'recovered refund blocked resume proposal'; END IF;
 IF approve_dispatch_resume(h,b,'resume-second')<>'resumed' THEN RAISE EXCEPTION 'recovered refund blocked resume approval'; END IF;
 -- A distinct later contradiction on that same order must still block another resume.
 IF record_verified_event('mock-remittance','recover-later-conflict',o::text||'-refund','confirmed','USD',1)<>'manual_review' THEN RAISE EXCEPTION 'later incident not quarantined'; END IF;
 IF halt_dispatch('operator_emergency')<>'halted' THEN RAISE EXCEPTION 'second halt failed'; END IF;
 SELECT max(id) INTO h FROM dispatch_halt_events;
 b:=import_statement_cut('recover-resume-later','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(current_setting('mwd.test.rows')::jsonb),current_setting('mwd.test.rows')::jsonb);
 BEGIN PERFORM propose_dispatch_resume(h,b,'resume-first'); RAISE EXCEPTION 'later incident bypassed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INCIDENTS_OPEN' THEN RAISE; END IF; END;
 IF NOT (SELECT halted FROM dispatch_control_summary) THEN RAISE EXCEPTION 'unsafe resume'; END IF;
 IF (SELECT count(*) FROM journal WHERE order_id=o)<>2 THEN RAISE EXCEPTION 'resume changed accounting'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN IF (SELECT completed FROM refund_recovery_summary)<>1 OR (SELECT orders FROM refund_attention)<>0 THEN RAISE EXCEPTION 'audit mismatch'; END IF; END $$;
RESET ROLE;
ROLLBACK;


-- postgres-dispatch-resume-lab.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
SELECT set_config('mwd.halt_baseline',(SELECT halt_count::text FROM dispatch_control_summary),true),set_config('mwd.resume_baseline',(SELECT resume_count::text FROM dispatch_control_summary),true);
UPDATE dispatch SET attempts=greatest(attempts,3) WHERE state<>'acknowledged';
INSERT INTO actor_policy VALUES ('resumeFixture','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('resumeFixture','beneficiary','verified');
DO $$ DECLARE q uuid; o uuid; l record; b uuid; h bigint;
BEGIN
 SELECT quote_id INTO q FROM issue_quote('resumeFixture','beneficiary',10000);
 o:=accept_quote('resumeFixture','first',q,'sandbox-disclosure-v1');
 SELECT * INTO l FROM claim_dispatch(30);
 IF NOT FOUND OR l.order_id<>o THEN RAISE EXCEPTION 'initial lease missing'; END IF;
 b:=import_statement_cut('resume-before','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length('[]'::jsonb),'[]'::jsonb);
 PERFORM set_config('mwd.resume_before',b::text,true);
 IF halt_dispatch('provider_outage')<>'halted' THEN RAISE EXCEPTION 'halt failed'; END IF;
 SELECT max(id) INTO h FROM dispatch_halt_events;
 PERFORM set_config('mwd.resume_halt',h::text,true);
 PERFORM set_config('mwd.resume_ref',l.reference,true);
 PERFORM set_config('mwd.resume_token',l.token::text,true);
 IF (SELECT lease_until FROM dispatch WHERE reference=l.reference)>clock_timestamp()
 THEN RAISE EXCEPTION 'old lease was not expired'; END IF;
 b:=import_statement_cut('resume-unresolved','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length('[]'::jsonb),'[]'::jsonb);
 PERFORM set_config('mwd.resume_unresolved',b::text,true);
END $$;
SET LOCAL ROLE mwd_lab_resume_proposer;
DO $$ DECLARE h bigint:=current_setting('mwd.resume_halt')::bigint;
BEGIN
 BEGIN PERFORM propose_dispatch_resume(h,current_setting('mwd.resume_before')::uuid,'first'); RAISE EXCEPTION 'stale evidence allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'RESUME_EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
 BEGIN PERFORM propose_dispatch_resume(h,current_setting('mwd.resume_unresolved')::uuid,'first'); RAISE EXCEPTION 'unresolved attempted reference allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'RESUME_RECONCILIATION_REQUIRED' THEN RAISE; END IF; END;
 BEGIN PERFORM approve_dispatch_resume(h,current_setting('mwd.resume_unresolved')::uuid,'first'); RAISE EXCEPTION 'proposer can approve';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ DECLARE q uuid; b uuid; rows jsonb; o uuid;
BEGIN
 IF record_verified_event('mock-remittance','resume-confirmation',current_setting('mwd.resume_ref'),'confirmed','USD',10150)<>'funded'
 THEN RAISE EXCEPTION 'incoming event lost'; END IF;
 SELECT quote_id INTO q FROM issue_quote('resumeFixture','beneficiary',10000);
 o:=accept_quote('resumeFixture','second',q,'sandbox-disclosure-v1');
 PERFORM set_config('mwd.resume_new_order',o::text,true);
 rows:=jsonb_build_array(jsonb_build_object('mode','sandbox','reference',current_setting('mwd.resume_ref'),'kind','funding','currency','USD','amountMinor',10150,'status','confirmed'));
 PERFORM set_config('mwd.resume_rows',rows::text,true);
 b:=import_statement('resume-legacy-complete',true,rows);
 PERFORM set_config('mwd.resume_legacy',b::text,true);
 BEGIN PERFORM check_resume_evidence(current_setting('mwd.resume_halt')::bigint,b); RAISE EXCEPTION 'legacy resume evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'RESUME_EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
 b:=import_statement_cut('resume-good1','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(rows),rows);
 PERFORM set_config('mwd.resume_good1',b::text,true);
END $$;
SET LOCAL ROLE mwd_lab_resume_proposer;
DO $$ DECLARE h bigint:=current_setting('mwd.resume_halt')::bigint; b uuid:=current_setting('mwd.resume_good1')::uuid;
BEGIN
 IF propose_dispatch_resume(h,b,'first')<>'proposed' OR propose_dispatch_resume(h,b,'first')<>'duplicate'
 THEN RAISE EXCEPTION 'proposal replay mismatch'; END IF;
END $$;
RESET ROLE;
SELECT import_statement_cut('resume-good2','US-HN:all-funding-payout-refund',clock_timestamp(),jsonb_array_length(current_setting('mwd.resume_rows')::jsonb),current_setting('mwd.resume_rows')::jsonb) AS good2 \gset
SELECT set_config('mwd.resume_good2',:'good2',true);
SET LOCAL ROLE mwd_lab_resume_approver;
DO $$ DECLARE h bigint:=current_setting('mwd.resume_halt')::bigint;
BEGIN
 BEGIN PERFORM approve_dispatch_resume(h,current_setting('mwd.resume_good1')::uuid,'second'); RAISE EXCEPTION 'superseded approval allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'RESUME_EVIDENCE_UNAVAILABLE' THEN RAISE; END IF; END;
 BEGIN PERFORM approve_dispatch_resume(h,current_setting('mwd.resume_good2')::uuid,'second'); RAISE EXCEPTION 'approval without proposal';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PROPOSAL_REQUIRED' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_resume_proposer;
SELECT propose_dispatch_resume(current_setting('mwd.resume_halt')::bigint,current_setting('mwd.resume_good2')::uuid,'first');
RESET ROLE;
SET LOCAL ROLE mwd_lab_resume_approver;
DO $$ DECLARE h bigint:=current_setting('mwd.resume_halt')::bigint; b uuid:=current_setting('mwd.resume_good2')::uuid;
BEGIN
 BEGIN PERFORM approve_dispatch_resume(h,b,'first'); RAISE EXCEPTION 'self approval allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SECOND_REVIEWER_REQUIRED' THEN RAISE; END IF; END;
 IF approve_dispatch_resume(h,b,'second')<>'resumed' THEN RAISE EXCEPTION 'resume failed'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE l record;
BEGIN
 IF check_dispatch_lease(current_setting('mwd.resume_ref'),current_setting('mwd.resume_token')::uuid) THEN RAISE EXCEPTION 'old lease revived'; END IF;
 SELECT * INTO l FROM claim_dispatch(30);
 IF NOT FOUND OR l.order_id<>current_setting('mwd.resume_new_order')::uuid OR l.attempts<>1
 THEN RAISE EXCEPTION 'new untouched order not processed'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF NOT (SELECT NOT halted AND halt_count=current_setting('mwd.halt_baseline')::bigint+1 AND resume_count=current_setting('mwd.resume_baseline')::bigint+1 FROM dispatch_control_summary)
 THEN RAISE EXCEPTION 'resume audit mismatch'; END IF;
 BEGIN PERFORM count(*) FROM dispatch_resume_approvals; RAISE EXCEPTION 'private approvals exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
DO $$ DECLARE legacy uuid; valid uuid; t timestamptz:=clock_timestamp();
BEGIN
 legacy:=import_statement('cut-gate-legacy',true,'[]');
 IF statement_cut_is_eligible(legacy,t) THEN RAISE EXCEPTION 'legacy cut eligible'; END IF;
 valid:=import_statement_cut('cut-gate-valid','US-HN:all-funding-payout-refund',clock_timestamp(),0,'[]');
 IF NOT statement_cut_is_eligible(valid,t) THEN RAISE EXCEPTION 'valid cut ineligible'; END IF;
 IF statement_cut_is_eligible(valid,clock_timestamp()+interval '1 second') THEN RAISE EXCEPTION 'pre-event cut eligible'; END IF;
END $$;
ROLLBACK;

-- The evidence decisions cannot use an old REPEATABLE READ transaction snapshot.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
DO $$
BEGIN
 BEGIN PERFORM check_statement_evidence(0,gen_random_uuid()); RAISE EXCEPTION 'review accepted stale isolation'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_ISOLATION_REQUIRED' THEN RAISE; END IF; END;
 BEGIN PERFORM check_refund_recovery(gen_random_uuid(),0,gen_random_uuid()); RAISE EXCEPTION 'refund accepted stale isolation'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVIDENCE_ISOLATION_REQUIRED' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
