-- Disposable laboratory only. Require explicit current provider cutoff for every new evidence decision.
BEGIN;
DO $$ BEGIN IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF; END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE FUNCTION statement_cut_is_eligible(p_batch uuid,p_not_before timestamptz) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path=mwd_financial_lab,pg_catalog AS $$
 SELECT EXISTS(SELECT FROM statement_cut_metadata m JOIN statement_batches b ON b.id=m.batch_id
 WHERE m.batch_id=p_batch AND b.complete
 AND m.scope='US-HN:all-funding-payout-refund'
 AND m.provider_as_of>=p_not_before
 AND m.provider_as_of>=clock_timestamp()-interval '15 minutes'
 AND m.provider_as_of<=b.captured_at
 AND m.declared_count=jsonb_array_length(b.payload)
 AND NOT EXISTS(SELECT FROM statement_cut_metadata n WHERE n.provider_as_of>m.provider_as_of));
$$;
REVOKE ALL ON FUNCTION statement_cut_is_eligible(uuid,timestamptz) FROM PUBLIC;
CREATE OR REPLACE FUNCTION check_statement_evidence(p_incident bigint,p_batch uuid) RETURNS void
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
 IF NOT statement_cut_is_eligible(p_batch,i.recorded_at) THEN RAISE EXCEPTION 'EVIDENCE_UNAVAILABLE'; END IF;
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
CREATE OR REPLACE FUNCTION check_refund_recovery(p_order uuid,p_incident bigint,p_batch uuid) RETURNS void
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
 IF NOT statement_cut_is_eligible(p_batch,i.recorded_at) THEN RAISE EXCEPTION 'EVIDENCE_UNAVAILABLE'; END IF;
 IF NOT EXISTS(SELECT FROM reconciliation_details d WHERE d.batch_id=b.id AND d.reference=o.id::text||'-funding' AND d.result='MATCHED_CONFIRMED')
 OR NOT EXISTS(SELECT FROM reconciliation_details d WHERE d.batch_id=b.id AND d.reference=o.id::text||'-payout' AND d.result='MATCHED_FAILED')
 THEN RAISE EXCEPTION 'ORDER_EVIDENCE_CONFLICT'; END IF;
 IF (SELECT count(*) FROM statement_external e WHERE e.batch_id=b.id AND e.reference=ref)<>1
 OR NOT EXISTS(SELECT FROM statement_external e WHERE e.batch_id=b.id AND e.reference=ref AND e.kind='refund'
 AND e.currency='USD' AND e.amount_minor=i.amount_minor AND e.status='confirmed')
 OR NOT EXISTS(SELECT FROM statement_internal s WHERE s.batch_id=b.id AND s.reference=ref AND s.status='pending')
 THEN RAISE EXCEPTION 'REFUND_EVIDENCE_MISMATCH'; END IF;
END $$;
CREATE OR REPLACE FUNCTION check_resume_evidence(p_halt bigint,p_batch uuid) RETURNS void
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
 IF NOT statement_cut_is_eligible(p_batch,h.recorded_at) THEN RAISE EXCEPTION 'RESUME_EVIDENCE_UNAVAILABLE'; END IF;
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
REVOKE ALL ON FUNCTION check_statement_evidence(bigint,uuid),check_refund_recovery(uuid,bigint,uuid),check_resume_evidence(bigint,uuid) FROM PUBLIC;
COMMIT;
