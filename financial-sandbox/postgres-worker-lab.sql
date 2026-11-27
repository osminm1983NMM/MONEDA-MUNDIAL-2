-- Disposable lab only, final preflight check before external transport.
BEGIN;
DO $$ BEGIN IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF; END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE FUNCTION check_dispatch_lease(p_ref text,p_token uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
 SELECT EXISTS(SELECT FROM dispatch d JOIN outbox x ON x.reference=d.reference
 JOIN orders o ON o.id=x.order_id JOIN reservations z ON z.order_id=o.id AND z.actor=o.actor
 JOIN actor_policy pol ON pol.actor=o.actor JOIN beneficiaries b ON b.actor=o.actor AND b.reference=o.beneficiary_ref
 WHERE d.reference=p_ref AND d.token=p_token AND d.state='leased' AND d.lease_until>clock_timestamp()
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 AND (x.kind='refund' OR (pol.identity='verified' AND pol.sanctions='clear' AND pol.risk='allow' AND b.status='verified'))
 AND NOT EXISTS(SELECT FROM event_incidents i LEFT JOIN outbox prior ON prior.reference=i.prior_reference
 LEFT JOIN outbox incoming ON incoming.reference=i.reference WHERE (prior.order_id=o.id OR incoming.order_id=o.id)
 AND NOT EXISTS(SELECT FROM review_approvals a WHERE a.incident_id=i.id)));
$$;
REVOKE ALL ON FUNCTION check_dispatch_lease(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_dispatch_lease(text,uuid) TO mwd_lab_dispatch_service;

-- Track transport acceptance separately from financial confirmation.
-- Existing disposable fixtures have no historical timestamps; initialize them at migration time.
ALTER TABLE dispatch ADD COLUMN queued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ADD COLUMN acknowledged_at timestamptz;
UPDATE dispatch SET acknowledged_at=clock_timestamp() WHERE state='acknowledged';
ALTER TABLE dispatch ADD CONSTRAINT dispatch_ack_timestamp CHECK(
 (state='acknowledged')=(acknowledged_at IS NOT NULL));
CREATE OR REPLACE FUNCTION acknowledge_dispatch(p_ref text,p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE deadline timestamptz; acknowledged timestamptz;
BEGIN
 -- Acquire the row before reading the clock. A concurrent row locker can
 -- delay an UPDATE without changing the tuple or rechecking its predicate.
 SELECT lease_until INTO deadline FROM dispatch
 WHERE reference=p_ref AND state='leased' AND token=p_token FOR NO KEY UPDATE;
 acknowledged:=clock_timestamp();
 IF deadline IS NULL OR deadline<=acknowledged THEN RAISE EXCEPTION 'STALE_LEASE'; END IF;
 UPDATE dispatch SET state='acknowledged',token=NULL,lease_until=NULL,acknowledged_at=acknowledged
 WHERE reference=p_ref;
END $$;
-- Read-only monitoring of reserved pending orders. Never dispatches, refunds or writes ledger.
-- Five minutes is a synthetic alert threshold, NOT a real provider SLA.
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
 WHERE d.attempts<3 AND (d.state='queued' OR (d.state='leased' AND d.lease_until<=v_now))
 AND (x.kind='refund' OR (pol.identity='verified' AND pol.sanctions='clear' AND pol.risk='allow' AND b.status='verified'))
 AND NOT EXISTS(SELECT FROM event_incidents i LEFT JOIN outbox prior ON prior.reference=i.prior_reference LEFT JOIN outbox incoming ON incoming.reference=i.reference WHERE (prior.order_id=o.id OR incoming.order_id=o.id) AND NOT EXISTS(SELECT FROM review_approvals ra WHERE ra.incident_id=i.id))
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 ORDER BY d.reference LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE dispatch d SET state='leased',token=gen_random_uuid(),lease_until=v_now+make_interval(secs=>p_lease_seconds),attempts=d.attempts+1 WHERE d.reference=v_ref;
 RETURN QUERY SELECT x.reference,x.order_id,x.kind,x.currency,x.amount_minor,d.token,d.lease_until,d.attempts
 FROM dispatch d JOIN outbox x ON x.reference=d.reference WHERE d.reference=v_ref;
END $$;
-- At most three automatic leases per reference in this synthetic lab.
CREATE VIEW dispatch_attention AS
 WITH pending AS (
 SELECT x.kind,x.currency,x.amount_minor,
 CASE
 WHEN EXISTS(SELECT FROM event_incidents i
  LEFT JOIN outbox prior ON prior.reference=i.prior_reference
  LEFT JOIN outbox incoming ON incoming.reference=i.reference
  WHERE (prior.order_id=o.id OR incoming.order_id=o.id)
   AND NOT EXISTS(SELECT FROM review_approvals a WHERE a.incident_id=i.id))
 THEN 'manual_review'
 WHEN d.state='acknowledged' THEN CASE
  WHEN d.acknowledged_at<=statement_timestamp()-interval '5 minutes' THEN 'provider_overdue'
  ELSE 'awaiting_provider' END
 WHEN x.kind<>'refund' AND (pol.identity IS DISTINCT FROM 'verified' OR pol.sanctions IS DISTINCT FROM 'clear'
 OR pol.risk IS DISTINCT FROM 'allow' OR b.status IS DISTINCT FROM 'verified') THEN 'policy_hold'
 -- Expiry does not establish absence of a remote payment: require review.
 WHEN x.kind='funding' AND q.expires_at<=statement_timestamp() THEN 'funding_quote_expired_review'
 WHEN d.attempts>=3 AND (d.state='queued' OR d.lease_until<=statement_timestamp()) THEN 'retry_budget_exhausted'
 WHEN d.state='leased' THEN CASE WHEN d.lease_until<=statement_timestamp() THEN 'lease_expired' ELSE 'leased' END
 WHEN d.queued_at<=statement_timestamp()-interval '5 minutes' THEN 'queued_overdue'
 ELSE 'queued' END AS reason
 FROM dispatch d JOIN outbox x ON x.reference=d.reference
 JOIN orders o ON o.id=x.order_id JOIN reservations z ON z.order_id=o.id AND z.actor=o.actor
 JOIN quotes q ON q.id=z.quote_id AND q.actor=z.actor
 LEFT JOIN actor_policy pol ON pol.actor=o.actor
 LEFT JOIN beneficiaries b ON b.actor=o.actor AND b.reference=o.beneficiary_ref
 WHERE o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END)
 SELECT kind,currency,reason,count(*) AS operations,sum(amount_minor) AS total_minor
 FROM pending GROUP BY kind,currency,reason;
REVOKE ALL ON dispatch_attention FROM PUBLIC;
GRANT SELECT ON dispatch_attention TO mwd_lab_audit_service;
REVOKE ALL ON FUNCTION acknowledge_dispatch(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acknowledge_dispatch(text,uuid) TO mwd_lab_dispatch_service;
COMMIT;
