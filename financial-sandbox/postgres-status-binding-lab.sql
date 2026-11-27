-- Private registry and least-privilege status service; disposable DB only.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=pg_catalog,mwd_financial_lab,pg_temp;
CREATE ROLE mwd_lab_status_service NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA mwd_financial_lab TO mwd_lab_status_service;
CREATE TABLE mwd_financial_lab.status_bindings(
 user_id uuid PRIMARY KEY,
 actor text NOT NULL UNIQUE REFERENCES mwd_financial_lab.actor_policy(actor),
 active boolean NOT NULL DEFAULT false,
 CHECK(actor=user_id::text)
);
REVOKE ALL ON TABLE mwd_financial_lab.status_bindings FROM PUBLIC;
CREATE FUNCTION mwd_financial_lab.resolve_status_binding(p_user uuid)
RETURNS TABLE(environment text,user_id uuid,actor text,active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $$
 SELECT 'sandbox'::text,b.user_id,b.actor,b.active FROM mwd_financial_lab.status_bindings b WHERE b.user_id=p_user
$$;
-- Recheck activation in the same statement as the status projection. A
-- concurrent revocation committed before this query cannot be bypassed by
-- a stale result from the earlier identity lookup.
CREATE FUNCTION mwd_financial_lab.read_bound_order_status(p_actor text,p_order uuid)
RETURNS TABLE(order_id uuid,status text,principal_minor bigint,fee_minor bigint,total_minor bigint,
 source_currency text,payout_minor bigint,payout_currency text,accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $$
 SELECT s.* FROM mwd_financial_lab.status_bindings b
 CROSS JOIN LATERAL mwd_financial_lab.read_order_status(b.actor,p_order) s
 WHERE b.actor=p_actor AND b.active
$$;
REVOKE ALL ON FUNCTION mwd_financial_lab.resolve_status_binding(uuid),mwd_financial_lab.read_bound_order_status(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mwd_financial_lab.resolve_status_binding(uuid),mwd_financial_lab.read_bound_order_status(text,uuid) TO mwd_lab_status_service;
COMMIT;
