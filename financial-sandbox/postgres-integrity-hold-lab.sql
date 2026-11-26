-- Disposable sandbox only. Fail closed on inconsistent reserved orders before transport.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE FUNCTION order_integrity_ok(p_order uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=mwd_financial_lab,pg_catalog AS $$
 SELECT EXISTS(SELECT FROM ledger_integrity_details l
 JOIN lifecycle_integrity_details c ON c.order_id=l.order_id
 WHERE l.order_id=p_order AND NOT l.balance_mismatch AND l.invalid_postings=0
 AND l.missing_postings=0 AND NOT c.reservation_mismatch AND c.intent_mismatches=0
 AND c.event_mismatches=0);
$$;
REVOKE ALL ON FUNCTION order_integrity_ok(uuid) FROM PUBLIC;
-- Both existing trusted dispatch entry points independently require intact records.
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
 AND order_integrity_ok(o.id)
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 ORDER BY d.reference LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE dispatch d SET state='leased',token=gen_random_uuid(),lease_until=v_now+make_interval(secs=>p_lease_seconds),attempts=d.attempts+1 WHERE d.reference=v_ref;
 RETURN QUERY SELECT x.reference,x.order_id,x.kind,x.currency,x.amount_minor,d.token,d.lease_until,d.attempts
 FROM dispatch d JOIN outbox x ON x.reference=d.reference WHERE d.reference=v_ref;
END $$;
CREATE OR REPLACE FUNCTION check_dispatch_lease(p_ref text,p_token uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
 SELECT EXISTS(SELECT FROM dispatch d JOIN outbox x ON x.reference=d.reference
 JOIN orders o ON o.id=x.order_id JOIN reservations z ON z.order_id=o.id AND z.actor=o.actor
 JOIN actor_policy pol ON pol.actor=o.actor JOIN beneficiaries b ON b.actor=o.actor AND b.reference=o.beneficiary_ref
 WHERE d.reference=p_ref AND d.token=p_token AND d.state='leased' AND d.lease_until>clock_timestamp()
 AND order_integrity_ok(o.id)
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 AND (x.kind='refund' OR (pol.identity='verified' AND pol.sanctions='clear' AND pol.risk='allow' AND b.status='verified'))
 AND NOT EXISTS(SELECT FROM event_incidents i LEFT JOIN outbox prior ON prior.reference=i.prior_reference
 LEFT JOIN outbox incoming ON incoming.reference=i.reference WHERE (prior.order_id=o.id OR incoming.order_id=o.id)
 AND NOT EXISTS(SELECT FROM review_approvals a WHERE a.incident_id=i.id)));
$$;
-- Aggregate number of blocked orders (including missing audit rows). No raw IDs to auditor.
CREATE VIEW integrity_hold_summary AS
 SELECT o.state,count(*) AS held_orders FROM orders o JOIN reservations z ON z.order_id=o.id
 WHERE NOT order_integrity_ok(o.id) GROUP BY o.state;
REVOKE ALL ON integrity_hold_summary FROM PUBLIC;
GRANT SELECT ON integrity_hold_summary TO mwd_lab_audit_service;
REVOKE ALL ON FUNCTION claim_dispatch(integer),check_dispatch_lease(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_dispatch(integer),check_dispatch_lease(text,uuid) TO mwd_lab_dispatch_service;
COMMIT;
