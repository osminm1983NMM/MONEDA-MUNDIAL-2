-- Disposable sandbox only. Recover an already-confirmed refund; never send or reissue funds.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TABLE refund_recovery_proposals(
 order_id uuid PRIMARY KEY REFERENCES orders(id),
 incident_id bigint NOT NULL UNIQUE REFERENCES event_incidents(id),
 batch_id uuid NOT NULL REFERENCES statement_batches(id),
 reviewer text NOT NULL CHECK(reviewer ~ '^[A-Za-z0-9_-]{1,100}$'),
 proposed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE refund_recovery_approvals(
 order_id uuid PRIMARY KEY REFERENCES refund_recovery_proposals(order_id),
 reviewer text NOT NULL CHECK(reviewer ~ '^[A-Za-z0-9_-]{1,100}$'),
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER refund_proposal_append_only BEFORE UPDATE OR DELETE ON refund_recovery_proposals FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE TRIGGER refund_approval_append_only BEFORE UPDATE OR DELETE ON refund_recovery_approvals FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE OR REPLACE FUNCTION record_verified_event(p_provider text,p_event text,p_ref text,p_outcome text,p_currency text,p_amount bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_reason text; v_prior text; v_result text;
BEGIN
 IF p_provider IS DISTINCT FROM 'mock-remittance' OR p_event IS NULL OR p_event !~ '^[A-Za-z0-9_-]{1,100}$'
 OR p_ref IS NULL OR p_ref !~ '^[A-Za-z0-9_-]{1,128}$' OR p_outcome IS NULL OR p_outcome NOT IN ('confirmed','failed')
 OR p_currency IS NULL OR p_currency NOT IN ('USD','HNL') OR p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'INVALID_EVENT'; END IF;
 -- Serialize reuse of an event ID across references, including unknown references.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_provider||':'||p_event,0));
 -- Serialize incident classification with order-level recovery and transitions.
 PERFORM o.id FROM orders o JOIN outbox x ON x.order_id=o.id WHERE x.reference=p_ref FOR UPDATE OF o;
 SELECT reference INTO v_prior FROM inbox WHERE provider=p_provider AND event_id=p_event;
 IF NOT EXISTS(SELECT FROM outbox WHERE reference=p_ref) THEN
  v_reason:='UNKNOWN_REFERENCE';
 ELSIF p_outcome='confirmed' AND EXISTS(
  SELECT FROM outbox x JOIN orders o ON o.id=x.order_id JOIN event_incidents i ON i.reference=x.reference
  WHERE x.reference=p_ref AND x.kind='refund' AND o.state='refund_pending' AND i.outcome='failed')
 THEN
  v_reason:='UNEXPECTED_EVENT_STATE';
 ELSE
  BEGIN
   v_result:=apply_verified_event(p_provider,p_event,p_ref,p_outcome,p_currency,p_amount);
   RETURN v_result;
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT IN ('EVENT_MISMATCH','EVENT_ID_CONFLICT','UNEXPECTED_EVENT_STATE') THEN RAISE; END IF;
   v_reason:=SQLERRM;
  END;
 END IF;
 INSERT INTO event_incidents(provider,event_id,reference,prior_reference,outcome,currency,amount_minor,reason)
 VALUES(p_provider,p_event,p_ref,v_prior,p_outcome,p_currency,p_amount,v_reason)
 ON CONFLICT(provider,event_id,reference,outcome,currency,amount_minor,reason) DO NOTHING;
 RETURN 'manual_review';
END $$;

CREATE FUNCTION check_refund_recovery(p_order uuid,p_incident bigint,p_batch uuid) RETURNS void
LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE o orders%ROWTYPE; i event_incidents%ROWTYPE; b statement_batches%ROWTYPE; ref text;
BEGIN
 PERFORM pg_advisory_xact_lock(60261126,17);
 SELECT * INTO o FROM orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.state<>'refund_pending' THEN RAISE EXCEPTION 'REFUND_UNAVAILABLE'; END IF;
 ref:=o.id::text||'-refund';
 SELECT * INTO i FROM event_incidents WHERE id=p_incident;
 IF NOT FOUND OR i.reference<>ref OR i.provider<>'mock-remittance' OR i.outcome<>'confirmed'
 OR i.currency<>'USD' OR i.amount_minor<>o.amount_cents+o.fee_cents
 OR i.reason<>'UNEXPECTED_EVENT_STATE' OR i.prior_reference IS NOT NULL
 OR EXISTS(SELECT FROM inbox WHERE provider=i.provider AND event_id=i.event_id)
 THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT FROM event_incidents f WHERE f.reference=ref AND f.outcome='failed'
 AND f.currency='USD' AND f.amount_minor=i.amount_minor AND f.recorded_at<=i.recorded_at)
 THEN RAISE EXCEPTION 'FAILURE_HISTORY_REQUIRED'; END IF;
 -- Other unresolved contradictions require escalation, not this narrow recovery path.
 IF EXISTS(SELECT FROM event_incidents f
 LEFT JOIN outbox x ON x.reference=f.reference LEFT JOIN outbox y ON y.reference=f.prior_reference
 WHERE (x.order_id=o.id OR y.order_id=o.id) AND f.id<>i.id
 AND NOT (f.reference=ref AND f.prior_reference IS NULL AND f.outcome='failed' AND f.reason='UNEXPECTED_EVENT_STATE'
 AND f.currency='USD' AND f.amount_minor=i.amount_minor AND f.recorded_at<=i.recorded_at)
 AND NOT EXISTS(SELECT FROM review_approvals a WHERE a.incident_id=f.id))
 THEN RAISE EXCEPTION 'OTHER_INCIDENTS_OPEN'; END IF;
 SELECT * INTO b FROM statement_batches WHERE id=p_batch;
 IF NOT FOUND OR NOT b.complete OR b.captured_at<i.recorded_at
 OR b.captured_at<clock_timestamp()-interval '15 minutes'
 OR EXISTS(SELECT FROM statement_batches newer WHERE newer.captured_at>b.captured_at OR (newer.captured_at=b.captured_at AND newer.id<>b.id))
 THEN RAISE EXCEPTION 'EVIDENCE_UNAVAILABLE'; END IF;
 IF NOT EXISTS(SELECT FROM reconciliation_details d WHERE d.batch_id=b.id AND d.reference=o.id::text||'-funding' AND d.result='MATCHED_CONFIRMED')
 OR NOT EXISTS(SELECT FROM reconciliation_details d WHERE d.batch_id=b.id AND d.reference=o.id::text||'-payout' AND d.result='MATCHED_FAILED')
 THEN RAISE EXCEPTION 'ORDER_EVIDENCE_CONFLICT'; END IF;
 IF (SELECT count(*) FROM statement_external e WHERE e.batch_id=b.id AND e.reference=ref)<>1
 OR NOT EXISTS(SELECT FROM statement_external e WHERE e.batch_id=b.id AND e.reference=ref AND e.kind='refund'
 AND e.currency='USD' AND e.amount_minor=i.amount_minor AND e.status='confirmed')
 OR NOT EXISTS(SELECT FROM statement_internal s WHERE s.batch_id=b.id AND s.reference=ref AND s.status='pending')
 THEN RAISE EXCEPTION 'REFUND_EVIDENCE_MISMATCH'; END IF;
END $$;
CREATE FUNCTION propose_refund_recovery(p_order uuid,p_incident bigint,p_batch uuid,p_reviewer text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE p refund_recovery_proposals%ROWTYPE;
BEGIN
 PERFORM check_refund_recovery(p_order,p_incident,p_batch);
 INSERT INTO refund_recovery_proposals(order_id,incident_id,batch_id,reviewer) VALUES(p_order,p_incident,p_batch,p_reviewer)
 ON CONFLICT(order_id) DO NOTHING RETURNING * INTO p;
 IF FOUND THEN RETURN 'proposed'; END IF;
 SELECT * INTO STRICT p FROM refund_recovery_proposals WHERE order_id=p_order;
 IF (p.incident_id,p.batch_id,p.reviewer) IS DISTINCT FROM (p_incident,p_batch,p_reviewer) THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 RETURN 'duplicate';
END $$;
CREATE FUNCTION approve_refund_recovery(p_order uuid,p_reviewer text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE p refund_recovery_proposals%ROWTYPE; a refund_recovery_approvals%ROWTYPE; i event_incidents%ROWTYPE; v_result text;
BEGIN
 PERFORM pg_advisory_xact_lock(60261126,17);
 PERFORM 1 FROM orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO p FROM refund_recovery_proposals WHERE order_id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_REQUIRED'; END IF;
 IF p_reviewer IS NULL OR p_reviewer=p.reviewer THEN RAISE EXCEPTION 'SECOND_REVIEWER_REQUIRED'; END IF;
 SELECT * INTO a FROM refund_recovery_approvals WHERE order_id=p_order;
 IF FOUND THEN
  IF a.reviewer<>p_reviewer THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
  RETURN 'duplicate';
 END IF;
 PERFORM check_refund_recovery(p_order,p.incident_id,p.batch_id);
 SELECT * INTO STRICT i FROM event_incidents WHERE id=p.incident_id;
 -- Apply the original quarantined authenticated event, not a manufactured event ID.
 v_result:=apply_verified_event(i.provider,i.event_id,i.reference,i.outcome,i.currency,i.amount_minor);
 IF v_result<>'refunded' THEN RAISE EXCEPTION 'REFUND_RECOVERY_FAILED'; END IF;
 INSERT INTO refund_recovery_approvals(order_id,reviewer) VALUES(p_order,p_reviewer);
 RETURN 'refunded';
END $$;
CREATE VIEW refund_recovery_summary AS SELECT count(*) AS proposed,count(a.order_id) AS completed
 FROM refund_recovery_proposals p LEFT JOIN refund_recovery_approvals a ON a.order_id=p.order_id;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
GRANT EXECUTE ON FUNCTION propose_refund_recovery(uuid,bigint,uuid,text) TO mwd_lab_review_proposer;
GRANT EXECUTE ON FUNCTION approve_refund_recovery(uuid,text) TO mwd_lab_review_approver;
GRANT SELECT ON refund_recovery_summary TO mwd_lab_audit_service;
COMMIT;
