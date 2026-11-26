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
COMMIT;
