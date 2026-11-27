-- Disposable sandbox only. Stop new outbound transport without discarding incoming evidence.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE ROLE mwd_lab_safety_service NOLOGIN;
CREATE TABLE dispatch_control(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 halted boolean NOT NULL DEFAULT false
);
INSERT INTO dispatch_control DEFAULT VALUES;
CREATE TABLE dispatch_halt_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 reason text NOT NULL CHECK(reason IN ('provider_outage','integrity_incident','security_incident','operator_emergency')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER halt_events_append_only BEFORE UPDATE OR DELETE ON dispatch_halt_events
 FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE FUNCTION halt_dispatch(p_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_halted boolean;
BEGIN
 IF p_reason IS NULL OR p_reason NOT IN ('provider_outage','integrity_incident','security_incident','operator_emergency')
 THEN RAISE EXCEPTION 'INVALID_HALT_REASON'; END IF;
 SELECT halted INTO STRICT v_halted FROM dispatch_control WHERE singleton FOR UPDATE;
 IF v_halted THEN RETURN 'already_halted'; END IF;
 UPDATE dispatch_control SET halted=true WHERE singleton;
 INSERT INTO dispatch_halt_events(reason) VALUES(p_reason);
 RETURN 'halted';
END $$;
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
 AND EXISTS(SELECT FROM dispatch_control WHERE singleton AND NOT halted)
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
 AND EXISTS(SELECT FROM dispatch_control WHERE singleton AND NOT halted)
 AND order_integrity_ok(o.id)
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 AND (x.kind='refund' OR (pol.identity='verified' AND pol.sanctions='clear' AND pol.risk='allow' AND b.status='verified'))
 AND NOT EXISTS(SELECT FROM event_incidents i LEFT JOIN outbox prior ON prior.reference=i.prior_reference
 LEFT JOIN outbox incoming ON incoming.reference=i.reference WHERE (prior.order_id=o.id OR incoming.order_id=o.id)
 AND NOT EXISTS(SELECT FROM review_approvals a WHERE a.incident_id=i.id)));
$$;
-- Missing control row is interpreted as halted. No resume entry point in this lab.
CREATE VIEW dispatch_control_summary AS
 SELECT NOT EXISTS(SELECT FROM dispatch_control WHERE singleton AND NOT halted) AS halted,
 (SELECT count(*) FROM dispatch_halt_events) AS halt_count;
REVOKE ALL ON dispatch_control,dispatch_halt_events,dispatch_control_summary FROM PUBLIC;
REVOKE ALL ON FUNCTION halt_dispatch(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA mwd_financial_lab TO mwd_lab_safety_service;
GRANT EXECUTE ON FUNCTION halt_dispatch(text) TO mwd_lab_safety_service;
GRANT SELECT ON dispatch_control_summary TO mwd_lab_audit_service;
COMMIT;
