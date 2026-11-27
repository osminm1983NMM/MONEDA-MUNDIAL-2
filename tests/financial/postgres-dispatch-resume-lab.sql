\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
UPDATE dispatch SET attempts=greatest(attempts,3) WHERE state<>'acknowledged';
INSERT INTO actor_policy VALUES ('resumeFixture','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('resumeFixture','beneficiary','verified');
DO $$ DECLARE q uuid; o uuid; l record; b uuid; h bigint;
BEGIN
 SELECT quote_id INTO q FROM issue_quote('resumeFixture','beneficiary',10000);
 o:=accept_quote('resumeFixture','first',q,'sandbox-disclosure-v1');
 SELECT * INTO l FROM claim_dispatch(30);
 IF NOT FOUND OR l.order_id<>o THEN RAISE EXCEPTION 'initial lease missing'; END IF;
 b:=import_statement('resume-before',true,'[]'::jsonb);
 PERFORM set_config('mwd.resume_before',b::text,true);
 IF halt_dispatch('provider_outage')<>'halted' THEN RAISE EXCEPTION 'halt failed'; END IF;
 SELECT max(id) INTO h FROM dispatch_halt_events;
 PERFORM set_config('mwd.resume_halt',h::text,true);
 PERFORM set_config('mwd.resume_ref',l.reference,true);
 PERFORM set_config('mwd.resume_token',l.token::text,true);
 IF (SELECT lease_until FROM dispatch WHERE reference=l.reference)>clock_timestamp()
 THEN RAISE EXCEPTION 'old lease was not expired'; END IF;
 b:=import_statement('resume-unresolved',true,'[]'::jsonb);
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
 b:=import_statement('resume-good1',true,rows);
 PERFORM set_config('mwd.resume_good1',b::text,true);
END $$;
SET LOCAL ROLE mwd_lab_resume_proposer;
DO $$ DECLARE h bigint:=current_setting('mwd.resume_halt')::bigint; b uuid:=current_setting('mwd.resume_good1')::uuid;
BEGIN
 IF propose_dispatch_resume(h,b,'first')<>'proposed' OR propose_dispatch_resume(h,b,'first')<>'duplicate'
 THEN RAISE EXCEPTION 'proposal replay mismatch'; END IF;
END $$;
RESET ROLE;
SELECT import_statement('resume-good2',true,current_setting('mwd.resume_rows')::jsonb) AS good2 \gset
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
 IF NOT (SELECT NOT halted AND halt_count=1 AND resume_count=1 FROM dispatch_control_summary)
 THEN RAISE EXCEPTION 'resume audit mismatch'; END IF;
 BEGIN PERFORM count(*) FROM dispatch_resume_approvals; RAISE EXCEPTION 'private approvals exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;

BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
INSERT INTO actor_policy VALUES ('queue-order-fixture','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('queue-order-fixture','beneficiary','verified');

SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('queue-order-fixture','beneficiary',10000) \gset q1_
SELECT accept_quote('queue-order-fixture','first',:'q1_quote_id','sandbox-disclosure-v1') || '-funding' AS ref \gset first_
SELECT quote_id FROM issue_quote('queue-order-fixture','beneficiary',10000) \gset q2_
SELECT accept_quote('queue-order-fixture','second',:'q2_quote_id','sandbox-disclosure-v1') || '-funding' AS ref \gset second_
RESET ROLE;

-- Assign the earlier timestamp to the lexically larger reference so this
-- test distinguishes chronological order from the prior UUID ordering.
SELECT set_config('mwd.queue.older',greatest(:'first_ref',:'second_ref'),true),
       set_config('mwd.queue.newer',least(:'first_ref',:'second_ref'),true);
UPDATE dispatch SET queued_at=statement_timestamp()-interval '1 minute'
WHERE reference=current_setting('mwd.queue.older');
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$
DECLARE claimed record;
BEGIN
 SELECT reference,attempts INTO STRICT claimed FROM claim_dispatch(30);
 IF claimed.reference<>current_setting('mwd.queue.older') OR claimed.attempts<>1
 THEN RAISE EXCEPTION 'OLDEST_ELIGIBLE_ORDER_NOT_CLAIMED'; END IF;
 SELECT reference,attempts INTO STRICT claimed FROM claim_dispatch(30);
 IF claimed.reference<>current_setting('mwd.queue.newer') OR claimed.attempts<>1
 THEN RAISE EXCEPTION 'ACTIVE_LEASE_NOT_SKIPPED'; END IF;
END $$;
RESET ROLE;

-- Equal timestamps still have a deterministic tie-break after both leases expire.
UPDATE dispatch SET queued_at=statement_timestamp(),lease_until=clock_timestamp()-interval '1 second'
WHERE reference IN (current_setting('mwd.queue.older'),current_setting('mwd.queue.newer'));
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$
DECLARE claimed record;
BEGIN
 SELECT reference,attempts INTO STRICT claimed FROM claim_dispatch(30);
 IF claimed.reference<>current_setting('mwd.queue.newer') OR claimed.attempts<>2
 THEN RAISE EXCEPTION 'QUEUE_TIE_BREAK_OR_RETRY_MISMATCH'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
