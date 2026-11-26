-- Disposable lab only. Link human-review fixtures to immutable statement evidence.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TABLE review_evidence(
 incident_id bigint PRIMARY KEY REFERENCES review_proposals(incident_id),
 batch_id uuid NOT NULL REFERENCES statement_batches(id),
 attached_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER review_evidence_append_only BEFORE UPDATE OR DELETE ON review_evidence
 FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE FUNCTION check_statement_evidence(p_incident bigint,p_batch uuid) RETURNS void
LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE i event_incidents%ROWTYPE; b statement_batches%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(60261126,17);
 PERFORM check_reviewable(p_incident);
 SELECT * INTO STRICT i FROM event_incidents WHERE id=p_incident;
 SELECT * INTO b FROM statement_batches WHERE id=p_batch;
 IF NOT FOUND OR NOT b.complete OR b.captured_at<i.recorded_at
 OR b.captured_at<clock_timestamp()-interval '15 minutes'
 OR EXISTS(SELECT FROM statement_batches newer WHERE newer.captured_at>b.captured_at OR (newer.captured_at=b.captured_at AND newer.id<>b.id))
 THEN RAISE EXCEPTION 'EVIDENCE_UNAVAILABLE'; END IF;
 -- A complete current statement must confirm this exact reference.
 -- Other unrelated pending references do not block this narrow review.
 IF NOT EXISTS(SELECT FROM reconciliation_details d WHERE d.batch_id=b.id
  AND d.reference=i.reference AND d.result='MATCHED_CONFIRMED')
 THEN RAISE EXCEPTION 'EVIDENCE_NOT_MATCHED'; END IF;
 -- Confirm all other terminal references of the affected order also match.
 IF EXISTS(SELECT FROM outbox x JOIN outbox target ON target.order_id=x.order_id AND target.reference=i.reference
 WHERE EXISTS(SELECT FROM inbox e WHERE e.reference=x.reference AND e.outcome IN ('confirmed','failed')) AND NOT EXISTS(
 SELECT FROM reconciliation_details d WHERE d.batch_id=b.id AND d.reference=x.reference
 AND d.result IN ('MATCHED_CONFIRMED','MATCHED_FAILED')))
 THEN RAISE EXCEPTION 'ORDER_EVIDENCE_CONFLICT'; END IF;
END $$;
CREATE FUNCTION propose_statement_review(p_incident bigint,p_reviewer text,p_batch uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_result text; v_batch uuid;
BEGIN
 PERFORM check_statement_evidence(p_incident,p_batch);
 v_result:=propose_review(p_incident,p_reviewer,'synthetic-'||p_batch::text);
 INSERT INTO review_evidence(incident_id,batch_id) VALUES(p_incident,p_batch) ON CONFLICT(incident_id) DO NOTHING;
 SELECT batch_id INTO STRICT v_batch FROM review_evidence WHERE incident_id=p_incident;
 IF v_batch<>p_batch THEN RAISE EXCEPTION 'EVIDENCE_MISMATCH'; END IF;
 RETURN v_result;
END $$;
CREATE FUNCTION approve_statement_review(p_incident bigint,p_reviewer text,p_batch uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
BEGIN
 PERFORM check_statement_evidence(p_incident,p_batch);
 IF NOT EXISTS(SELECT FROM review_evidence WHERE incident_id=p_incident AND batch_id=p_batch)
 THEN RAISE EXCEPTION 'EVIDENCE_MISMATCH'; END IF;
 RETURN approve_review(p_incident,p_reviewer,'synthetic-'||p_batch::text);
END $$;
REVOKE EXECUTE ON FUNCTION propose_review(bigint,text,text) FROM mwd_lab_review_proposer;
REVOKE EXECUTE ON FUNCTION approve_review(bigint,text,text) FROM mwd_lab_review_approver;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
GRANT EXECUTE ON FUNCTION propose_statement_review(bigint,text,uuid) TO mwd_lab_review_proposer;
GRANT EXECUTE ON FUNCTION approve_statement_review(bigint,text,uuid) TO mwd_lab_review_approver;
CREATE VIEW review_evidence_summary AS SELECT count(*) AS attached,
 count(a.incident_id) AS approved FROM review_evidence e LEFT JOIN review_approvals a ON a.incident_id=e.incident_id;
GRANT SELECT ON review_evidence_summary TO mwd_lab_audit_service;
COMMIT;
