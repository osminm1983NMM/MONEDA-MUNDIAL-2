-- Disposable sandbox only. Two distinct reviewers and fresh reconciliation before resuming.
BEGIN;
DO $$ BEGIN IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF; END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE ROLE mwd_lab_resume_proposer NOLOGIN;
CREATE ROLE mwd_lab_resume_approver NOLOGIN;
CREATE TABLE dispatch_resume_proposals(
 halt_id bigint NOT NULL REFERENCES dispatch_halt_events(id),
 batch_id uuid NOT NULL REFERENCES statement_batches(id),
 reviewer text NOT NULL CHECK(reviewer ~ '^[A-Za-z0-9_-]{1,100}$'),
 proposed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(halt_id,batch_id)
);
CREATE TABLE dispatch_resume_approvals(
 halt_id bigint PRIMARY KEY,
 batch_id uuid NOT NULL,
 reviewer text NOT NULL CHECK(reviewer ~ '^[A-Za-z0-9_-]{1,100}$'),
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(halt_id,batch_id) REFERENCES dispatch_resume_proposals(halt_id,batch_id)
);
CREATE TRIGGER resume_proposals_append_only BEFORE UPDATE OR DELETE ON dispatch_resume_proposals FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE TRIGGER resume_approvals_append_only BEFORE UPDATE OR DELETE ON dispatch_resume_approvals FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE OR REPLACE FUNCTION halt_dispatch(p_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_halted boolean;
BEGIN
 IF p_reason IS NULL OR p_reason NOT IN ('provider_outage','integrity_incident','security_incident','operator_emergency') THEN RAISE EXCEPTION 'INVALID_HALT_REASON'; END IF;
 SELECT halted INTO STRICT v_halted FROM dispatch_control WHERE singleton FOR UPDATE;
 IF v_halted THEN RETURN 'already_halted'; END IF;
 UPDATE dispatch_control SET halted=true WHERE singleton;
 INSERT INTO dispatch_halt_events(reason) VALUES(p_reason);
 -- Existing leases cannot become valid again simply because transport resumes.
 UPDATE dispatch SET lease_until=least(lease_until,clock_timestamp()) WHERE state='leased';
 RETURN 'halted';
END $$;
CREATE OR REPLACE FUNCTION claim_dispatch(p_lease_seconds integer)
RETURNS TABLE(reference text,order_id uuid,kind text,currency text,amount_minor bigint,token uuid,lease_until timestamptz,attempts bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_ref text; v_now timestamptz;
BEGIN
 IF p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'INVALID_LEASE'; END IF;
 -- Serialize new leases with emergency stop and resume.
 PERFORM 1 FROM dispatch_control WHERE singleton AND NOT halted FOR SHARE;
 IF NOT FOUND THEN RETURN; END IF;
 v_now:=clock_timestamp();
 SELECT d.reference INTO v_ref FROM dispatch d
 JOIN outbox x ON x.reference=d.reference
 JOIN orders o ON o.id=x.order_id
 JOIN reservations z ON z.order_id=o.id AND z.actor=o.actor
 JOIN actor_policy pol ON pol.actor=o.actor
 JOIN beneficiaries b ON b.actor=o.actor AND b.reference=o.beneficiary_ref
 WHERE d.attempts<3 AND (d.state='queued' OR (d.state='leased' AND d.lease_until<=v_now))
 AND (x.kind='refund' OR (pol.identity='verified' AND pol.sanctions='clear' AND pol.risk='allow' AND b.status='verified'))
 AND NOT EXISTS(SELECT FROM event_incidents i LEFT JOIN outbox prior ON prior.reference=i.prior_reference LEFT JOIN outbox incoming ON incoming.reference=i.reference WHERE (prior.order_id=o.id OR incoming.order_id=o.id) AND NOT EXISTS(SELECT FROM review_approvals ra WHERE ra.incident_id=i.id))
 AND EXISTS(SELECT FROM dispatch_control WHERE singleton AND NOT halted)
 AND order_integrity_ok(o.id)
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 ORDER BY d.queued_at,d.reference LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE dispatch d SET state='leased',token=gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=d.attempts+1 WHERE d.reference=v_ref;
 RETURN QUERY SELECT x.reference,x.order_id,x.kind,x.currency,x.amount_minor,d.token,d.lease_until,d.attempts
 FROM dispatch d JOIN outbox x ON x.reference=d.reference WHERE d.reference=v_ref;
END $$;
CREATE FUNCTION check_resume_evidence(p_halt bigint,p_batch uuid) RETURNS void
LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE h dispatch_halt_events%ROWTYPE; b statement_batches%ROWTYPE;
BEGIN
 -- Serialize against statement import and other resume decisions.
 PERFORM pg_advisory_xact_lock(60261126,17);
 PERFORM 1 FROM dispatch_control WHERE singleton AND halted FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HALT_REQUIRED'; END IF;
 -- READ COMMITTED is required so checks after the locks use a fresh snapshot.
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'RESUME_ISOLATION_REQUIRED'; END IF;
 -- Freeze the internal evidence until this transaction commits. Do not wait on
 -- a writer that could itself be waiting for the emergency control row.
 BEGIN
  LOCK TABLE orders,quotes,reservations,outbox,dispatch,inbox,journal,event_incidents,review_approvals
   IN SHARE MODE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'RESUME_EVIDENCE_BUSY';
 END;
 SELECT * INTO h FROM dispatch_halt_events ORDER BY id DESC LIMIT 1;
 IF NOT FOUND OR h.id IS DISTINCT FROM p_halt THEN RAISE EXCEPTION 'HALT_MISMATCH'; END IF;
 SELECT * INTO b FROM statement_batches WHERE id=p_batch;
 IF NOT FOUND OR NOT b.complete OR b.captured_at<h.recorded_at
 OR b.captured_at<clock_timestamp()-interval '15 minutes'
 OR EXISTS(SELECT FROM statement_batches n WHERE n.captured_at>b.captured_at OR (n.captured_at=b.captured_at AND n.id<>b.id))
 THEN RAISE EXCEPTION 'RESUME_EVIDENCE_UNAVAILABLE'; END IF;
 IF EXISTS(SELECT FROM orders o JOIN reservations z ON z.order_id=o.id WHERE NOT order_integrity_ok(o.id))
 THEN RAISE EXCEPTION 'INTEGRITY_HOLD'; END IF;
 IF EXISTS(SELECT FROM event_incidents i WHERE NOT EXISTS(SELECT FROM review_approvals a WHERE a.incident_id=i.id))
 THEN RAISE EXCEPTION 'INCIDENTS_OPEN'; END IF;
 -- Require the exact current reserved reference universe, amounts and accepted event status.
 IF EXISTS(
 WITH live AS (
 SELECT x.reference,x.kind,x.currency,x.amount_minor,
 CASE WHEN EXISTS(SELECT FROM inbox i WHERE i.reference=x.reference AND i.outcome='confirmed') THEN 'confirmed'
 WHEN EXISTS(SELECT FROM inbox i WHERE i.reference=x.reference AND i.outcome='failed') THEN 'failed' ELSE 'pending' END AS status
 FROM outbox x JOIN reservations z ON z.order_id=x.order_id
 ), snap AS (
 SELECT reference,kind,currency,amount_minor,status FROM statement_internal WHERE batch_id=p_batch
 )
 (SELECT * FROM live EXCEPT SELECT * FROM snap)
 UNION ALL (SELECT * FROM snap EXCEPT SELECT * FROM live))
 THEN RAISE EXCEPTION 'RESUME_SNAPSHOT_CHANGED'; END IF;
 -- Only a never-leased queued intent may be absent from the complete provider statement.
 IF EXISTS(SELECT FROM reconciliation_details d
 WHERE d.batch_id=p_batch AND d.result NOT IN ('MATCHED_CONFIRMED','MATCHED_FAILED')
 AND NOT (d.result='MISSING_PROVIDER' AND EXISTS(
 SELECT FROM dispatch x JOIN statement_internal s ON s.reference=x.reference AND s.batch_id=p_batch
 WHERE x.reference=d.reference AND x.state='queued' AND x.attempts=0 AND s.status='pending')))
 THEN RAISE EXCEPTION 'RESUME_RECONCILIATION_REQUIRED'; END IF;
END $$;
CREATE FUNCTION propose_dispatch_resume(p_halt bigint,p_batch uuid,p_reviewer text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE p dispatch_resume_proposals%ROWTYPE;
BEGIN
 PERFORM check_resume_evidence(p_halt,p_batch);
 INSERT INTO dispatch_resume_proposals(halt_id,batch_id,reviewer) VALUES(p_halt,p_batch,p_reviewer)
 ON CONFLICT(halt_id,batch_id) DO NOTHING RETURNING * INTO p;
 IF FOUND THEN RETURN 'proposed'; END IF;
 SELECT * INTO STRICT p FROM dispatch_resume_proposals WHERE halt_id=p_halt AND batch_id=p_batch;
 IF p.reviewer IS DISTINCT FROM p_reviewer THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 RETURN 'duplicate';
END $$;
CREATE FUNCTION approve_dispatch_resume(p_halt bigint,p_batch uuid,p_reviewer text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE p dispatch_resume_proposals%ROWTYPE;
BEGIN
 PERFORM check_resume_evidence(p_halt,p_batch);
 SELECT * INTO p FROM dispatch_resume_proposals WHERE halt_id=p_halt AND batch_id=p_batch;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_REQUIRED'; END IF;
 IF p_reviewer IS NULL OR p_reviewer=p.reviewer THEN RAISE EXCEPTION 'SECOND_REVIEWER_REQUIRED'; END IF;
 INSERT INTO dispatch_resume_approvals(halt_id,batch_id,reviewer) VALUES(p_halt,p_batch,p_reviewer);
 UPDATE dispatch_control SET halted=false WHERE singleton;
 RETURN 'resumed';
END $$;
CREATE OR REPLACE VIEW dispatch_control_summary AS
 SELECT NOT EXISTS(SELECT FROM dispatch_control WHERE singleton AND NOT halted) AS halted,
 (SELECT count(*) FROM dispatch_halt_events) AS halt_count,
 (SELECT count(*) FROM dispatch_resume_approvals) AS resume_count;
REVOKE ALL ON dispatch_resume_proposals,dispatch_resume_approvals FROM PUBLIC;
REVOKE ALL ON FUNCTION check_resume_evidence(bigint,uuid),propose_dispatch_resume(bigint,uuid,text),approve_dispatch_resume(bigint,uuid,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA mwd_financial_lab TO mwd_lab_resume_proposer,mwd_lab_resume_approver;
GRANT EXECUTE ON FUNCTION propose_dispatch_resume(bigint,uuid,text) TO mwd_lab_resume_proposer;
GRANT EXECUTE ON FUNCTION approve_dispatch_resume(bigint,uuid,text) TO mwd_lab_resume_approver;
COMMIT;
