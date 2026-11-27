-- Disposable PostgreSQL laboratory only; apply after postgres-lab.sql.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE ROLE mwd_lab_order_service NOLOGIN;
CREATE ROLE mwd_lab_dispatch_service NOLOGIN;
CREATE ROLE mwd_lab_event_service NOLOGIN;
CREATE ROLE mwd_lab_audit_service NOLOGIN;
CREATE TABLE dispatch (
 reference text PRIMARY KEY REFERENCES outbox(reference),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','acknowledged')),
 token uuid,
 lease_until timestamptz,
 attempts bigint NOT NULL DEFAULT 0 CHECK(attempts>=0),
 CHECK ((state='leased' AND token IS NOT NULL AND lease_until IS NOT NULL) OR
 (state<>'leased' AND token IS NULL AND lease_until IS NULL))
);
INSERT INTO dispatch(reference) SELECT reference FROM outbox;
CREATE FUNCTION enqueue_dispatch() RETURNS trigger LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
BEGIN INSERT INTO dispatch(reference) VALUES(NEW.reference); RETURN NEW; END $$;
CREATE TRIGGER outbox_dispatch AFTER INSERT ON outbox FOR EACH ROW EXECUTE FUNCTION enqueue_dispatch();
CREATE FUNCTION claim_dispatch(p_lease_seconds integer)
RETURNS TABLE(reference text,order_id uuid,kind text,currency text,amount_minor bigint,token uuid,lease_until timestamptz,attempts bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_ref text; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'INVALID_LEASE'; END IF;
 SELECT d.reference INTO v_ref FROM dispatch d
 JOIN outbox x ON x.reference=d.reference
 JOIN orders o ON o.id=x.order_id
 WHERE (d.state='queued' OR (d.state='leased' AND d.lease_until<=v_now))
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 ORDER BY d.reference LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE dispatch d SET state='leased',token=gen_random_uuid(),lease_until=v_now+make_interval(secs=>p_lease_seconds),attempts=d.attempts+1 WHERE d.reference=v_ref;
 RETURN QUERY SELECT x.reference,x.order_id,x.kind,x.currency,x.amount_minor,d.token,d.lease_until,d.attempts
 FROM dispatch d JOIN outbox x ON x.reference=d.reference WHERE d.reference=v_ref;
END $$;
CREATE FUNCTION acknowledge_dispatch(p_ref text,p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
BEGIN
 UPDATE dispatch d SET state='acknowledged',token=NULL,lease_until=NULL
 WHERE d.reference=p_ref AND d.state='leased' AND d.token=p_token AND d.lease_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'STALE_LEASE'; END IF;
END $$;
-- Trusted server interfaces only. Roles cannot log in directly or alter tables.
ALTER FUNCTION create_order(text,text,text,text,bigint) SECURITY DEFINER;
ALTER FUNCTION prepare_next(uuid,text) SECURITY DEFINER;
ALTER FUNCTION apply_verified_event(text,text,text,text,text,bigint) SECURITY DEFINER;
CREATE VIEW audit_summary AS SELECT o.state,count(*) AS orders,
 coalesce(sum(o.amount_cents+o.fee_cents),0) AS total_cents
 FROM orders o GROUP BY o.state;
CREATE VIEW journal_summary AS SELECT coalesce(sum(cash),0) AS cash,
 coalesce(sum(payable),0) AS payable,coalesce(sum(revenue),0) AS revenue,count(*) AS postings FROM journal;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA mwd_financial_lab TO mwd_lab_order_service,mwd_lab_dispatch_service,mwd_lab_event_service,mwd_lab_audit_service;
GRANT EXECUTE ON FUNCTION create_order(text,text,text,text,bigint),prepare_next(uuid,text) TO mwd_lab_order_service;
GRANT EXECUTE ON FUNCTION claim_dispatch(integer),acknowledge_dispatch(text,uuid) TO mwd_lab_dispatch_service;
GRANT EXECUTE ON FUNCTION apply_verified_event(text,text,text,text,text,bigint) TO mwd_lab_event_service;
GRANT SELECT ON audit_summary,journal_summary TO mwd_lab_audit_service;
COMMIT;
