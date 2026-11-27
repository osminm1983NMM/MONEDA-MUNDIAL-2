-- Hosted sandbox only. The reader stays NOLOGIN and is not granted to API roles.
-- A trusted server must authenticate the user BEFORE setting the transaction-local
-- verified_actor. This GUC is NOT a JWT verifier or a boundary against a compromised server.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard WHERE environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled)
 OR EXISTS(SELECT 1 FROM mwd_financial_hosted.status_bindings)
 OR EXISTS(SELECT 1 FROM mwd_financial_hosted.order_status_projection)
 OR EXISTS(SELECT 1 FROM auth.users)
 THEN RAISE EXCEPTION 'EMPTY_HOSTED_LAB_REQUIRED'; END IF;
END $$;
CREATE ROLE mwd_hosted_status_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
GRANT mwd_hosted_status_reader TO postgres WITH SET TRUE, INHERIT FALSE;
GRANT USAGE ON SCHEMA mwd_financial_hosted TO mwd_hosted_status_reader;
GRANT SELECT ON mwd_financial_hosted.environment_guard,mwd_financial_hosted.status_bindings,mwd_financial_hosted.order_status_projection TO mwd_hosted_status_reader;
CREATE POLICY reader_guard ON mwd_financial_hosted.environment_guard FOR SELECT TO mwd_hosted_status_reader
 USING (environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled);
CREATE POLICY reader_binding ON mwd_financial_hosted.status_bindings FOR SELECT TO mwd_hosted_status_reader
 USING (user_id::text=current_setting('mwd.verified_actor',true));
CREATE POLICY reader_order ON mwd_financial_hosted.order_status_projection FOR SELECT TO mwd_hosted_status_reader
 USING (user_id::text=current_setting('mwd.verified_actor',true)
 AND EXISTS(SELECT 1 FROM mwd_financial_hosted.status_bindings b WHERE b.user_id=order_status_projection.user_id AND b.active)
 AND EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard));
CREATE FUNCTION mwd_financial_hosted.resolve_status_binding(p_user uuid)
 RETURNS TABLE(environment text,user_id uuid,actor text,active boolean)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,mwd_financial_hosted,pg_temp AS $$
 SELECT 'sandbox'::text,b.user_id,b.user_id::text,b.active FROM mwd_financial_hosted.status_bindings b
 WHERE b.user_id=p_user AND EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard)
 $$;
CREATE FUNCTION mwd_financial_hosted.read_bound_order_status(p_actor text,p_order uuid)
 RETURNS TABLE(order_id uuid,status text,principal_minor bigint,fee_minor bigint,total_minor bigint,source_currency text,payout_minor bigint,payout_currency text,accepted_at timestamptz)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,mwd_financial_hosted,pg_temp AS $$
 SELECT o.order_id,o.status,o.principal_minor,o.fee_minor,o.total_minor,o.source_currency,o.payout_minor,o.payout_currency,o.accepted_at
 FROM mwd_financial_hosted.order_status_projection o
 WHERE o.user_id::text=p_actor AND o.order_id=p_order
 $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_hosted FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mwd_financial_hosted.resolve_status_binding(uuid),mwd_financial_hosted.read_bound_order_status(text,uuid) TO mwd_hosted_status_reader;
COMMIT;
