-- Synthetic review only. No real disbursement, settlement or manual adjustment.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE ROLE mwd_lab_review_proposer NOLOGIN;
CREATE ROLE mwd_lab_review_approver NOLOGIN;
CREATE TABLE review_proposals(
 incident_id bigint PRIMARY KEY REFERENCES event_incidents(id),
 reviewer text NOT NULL CHECK(reviewer ~ '^[A-Za-z0-9_-]{1,100}$'),
 evidence_ref text NOT NULL CHECK(evidence_ref ~ '^synthetic-[A-Za-z0-9_-]{1,90}$'),
 proposed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE review_approvals(
 incident_id bigint PRIMARY KEY REFERENCES review_proposals(incident_id),
 reviewer text NOT NULL CHECK(reviewer ~ '^[A-Za-z0-9_-]{1,100}$'),
 evidence_ref text NOT NULL CHECK(evidence_ref ~ '^synthetic-[A-Za-z0-9_-]{1,90}$'),
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER proposals_append_only BEFORE UPDATE OR DELETE ON review_proposals FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE TRIGGER approvals_append_only BEFORE UPDATE OR DELETE ON review_approvals FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
-- Only conflicts on a known reference with a previously accepted confirmed event
-- may be dismissed in this lab. No new posting or reversal is authorized.
CREATE FUNCTION check_reviewable(p_incident bigint) RETURNS void
LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE i event_incidents%ROWTYPE;
BEGIN
 SELECT * INTO i FROM event_incidents WHERE id=p_incident FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INCIDENT_UNAVAILABLE'; END IF;
 IF i.reason NOT IN ('EVENT_MISMATCH','EVENT_ID_CONFLICT','UNEXPECTED_EVENT_STATE')
 OR (i.prior_reference IS NOT NULL AND i.prior_reference<>i.reference)
 OR NOT EXISTS(SELECT FROM inbox e JOIN journal j ON j.provider=e.provider AND j.event_id=e.event_id WHERE e.reference=i.reference AND e.outcome='confirmed')
 THEN RAISE EXCEPTION 'ESCALATION_REQUIRED'; END IF;
END $$;
CREATE FUNCTION propose_review(p_incident bigint,p_reviewer text,p_evidence text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE old review_proposals%ROWTYPE;
BEGIN
 PERFORM check_reviewable(p_incident);
 INSERT INTO review_proposals(incident_id,reviewer,evidence_ref) VALUES(p_incident,p_reviewer,p_evidence)
 ON CONFLICT(incident_id) DO NOTHING RETURNING * INTO old;
 IF FOUND THEN RETURN 'proposed'; END IF;
 SELECT * INTO STRICT old FROM review_proposals WHERE incident_id=p_incident;
 IF (old.reviewer,old.evidence_ref) IS DISTINCT FROM (p_reviewer,p_evidence) THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 RETURN 'duplicate';
END $$;
CREATE FUNCTION approve_review(p_incident bigint,p_reviewer text,p_evidence text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE proposal review_proposals%ROWTYPE; old review_approvals%ROWTYPE;
BEGIN
 PERFORM check_reviewable(p_incident);
 SELECT * INTO proposal FROM review_proposals WHERE incident_id=p_incident;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_REQUIRED'; END IF;
 IF p_reviewer IS NULL OR p_reviewer=proposal.reviewer THEN RAISE EXCEPTION 'SECOND_REVIEWER_REQUIRED'; END IF;
 IF p_evidence IS DISTINCT FROM proposal.evidence_ref THEN RAISE EXCEPTION 'EVIDENCE_MISMATCH'; END IF;
 INSERT INTO review_approvals(incident_id,reviewer,evidence_ref) VALUES(p_incident,p_reviewer,p_evidence)
 ON CONFLICT(incident_id) DO NOTHING RETURNING * INTO old;
 IF FOUND THEN RETURN 'approved'; END IF;
 SELECT * INTO STRICT old FROM review_approvals WHERE incident_id=p_incident;
 IF (old.reviewer,old.evidence_ref) IS DISTINCT FROM (p_reviewer,p_evidence) THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 RETURN 'duplicate';
END $$;
CREATE VIEW review_summary AS SELECT i.reason,
 count(*) FILTER (WHERE a.incident_id IS NULL) AS open_incidents,
 count(*) FILTER (WHERE a.incident_id IS NOT NULL) AS approved_incidents
 FROM event_incidents i LEFT JOIN review_approvals a ON a.incident_id=i.id GROUP BY i.reason;
-- Failed refunds have no accepted confirmed posting and are deliberately not reviewable
-- by the dismissal workflow. Retain the entire liability and escalate, never retry blindly.
CREATE VIEW refund_attention AS SELECT count(DISTINCT o.id) AS orders,
 coalesce(sum(o.amount_cents+o.fee_cents),0) AS outstanding_cents
 FROM orders o WHERE o.state='refund_pending' AND EXISTS(
 SELECT FROM outbox x JOIN event_incidents i ON i.reference=x.reference
 WHERE x.order_id=o.id AND x.kind='refund' AND i.outcome='failed'
 AND NOT EXISTS(SELECT FROM review_approvals a WHERE a.incident_id=i.id));
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA mwd_financial_lab TO mwd_lab_review_proposer,mwd_lab_review_approver;
GRANT EXECUTE ON FUNCTION propose_review(bigint,text,text) TO mwd_lab_review_proposer;
GRANT EXECUTE ON FUNCTION approve_review(bigint,text,text) TO mwd_lab_review_approver;
GRANT SELECT ON review_summary,refund_attention TO mwd_lab_audit_service;
CREATE OR REPLACE FUNCTION claim_dispatch(p_lease_seconds integer)
RETURNS TABLE(reference text,order_id uuid,kind text,currency text,amount_minor bigint,token uuid,lease_until timestamptz,attempts bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_ref text; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'INVALID_LEASE'; END IF;
 SELECT d.reference INTO v_ref FROM dispatch d
 JOIN outbox x ON x.reference=d.reference
 JOIN orders o ON o.id=x.order_id
 JOIN reservations z ON z.order_id=o.id AND z.actor=o.actor
 JOIN actor_policy pol ON pol.actor=o.actor
 JOIN beneficiaries b ON b.actor=o.actor AND b.reference=o.beneficiary_ref
 WHERE (d.state='queued' OR (d.state='leased' AND d.lease_until<=v_now))
 AND (x.kind='refund' OR (pol.identity='verified' AND pol.sanctions='clear' AND pol.risk='allow' AND b.status='verified'))
 AND NOT EXISTS(SELECT FROM event_incidents i LEFT JOIN outbox prior ON prior.reference=i.prior_reference LEFT JOIN outbox incoming ON incoming.reference=i.reference WHERE (prior.order_id=o.id OR incoming.order_id=o.id) AND NOT EXISTS(SELECT FROM review_approvals ra WHERE ra.incident_id=i.id))
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 ORDER BY d.reference LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE dispatch d SET state='leased',token=gen_random_uuid(),lease_until=v_now+make_interval(secs=>p_lease_seconds),attempts=d.attempts+1 WHERE d.reference=v_ref;
 RETURN QUERY SELECT x.reference,x.order_id,x.kind,x.currency,x.amount_minor,d.token,d.lease_until,d.attempts
 FROM dispatch d JOIN outbox x ON x.reference=d.reference WHERE d.reference=v_ref;
END $$;


COMMIT;
