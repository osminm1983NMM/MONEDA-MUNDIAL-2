-- Hosted sandbox read-only authenticated RPC; never a payment endpoint.
-- Public invoker function, private RLS tables; no service key needed by mobile.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard WHERE environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled)
 OR EXISTS(SELECT 1 FROM auth.users)
 OR EXISTS(SELECT 1 FROM mwd_financial_hosted.order_status_projection)
 THEN RAISE EXCEPTION 'EMPTY_HOSTED_LAB_REQUIRED'; END IF;
END $$;
-- Narrow private helper: returns only whether the caller's verified JWT session
-- still belongs to an eligible user. Gateway verifies JWT signature and expiry.
CREATE FUNCTION mwd_financial_hosted.has_live_session() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=auth.uid(); j jsonb:=auth.jwt(); sid text;
BEGIN
 IF u IS NULL OR j->>'role' IS DISTINCT FROM 'authenticated' OR j->>'is_anonymous' IS DISTINCT FROM 'false' THEN RETURN false; END IF;
 sid:=j->>'session_id';
 IF sid IS NULL OR sid !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM auth.sessions s JOIN auth.users a ON a.id=s.user_id
 WHERE s.id=sid::uuid AND s.user_id=u AND (s.not_after IS NULL OR s.not_after>statement_timestamp())
 AND NOT a.is_anonymous AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=statement_timestamp()));
END $$;
REVOKE ALL ON FUNCTION mwd_financial_hosted.has_live_session() FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA mwd_financial_hosted TO authenticated;
GRANT EXECUTE ON FUNCTION mwd_financial_hosted.has_live_session() TO authenticated;
GRANT SELECT(environment,live_funds_enabled,provider_dispatch_enabled) ON mwd_financial_hosted.environment_guard TO authenticated;
GRANT SELECT(user_id,active) ON mwd_financial_hosted.status_bindings TO authenticated;
GRANT SELECT(order_id,user_id,status,principal_minor,fee_minor,total_minor,source_currency,payout_minor,payout_currency,accepted_at) ON mwd_financial_hosted.order_status_projection TO authenticated;
CREATE POLICY auth_guard_read ON mwd_financial_hosted.environment_guard FOR SELECT TO authenticated
 USING (environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled AND (SELECT mwd_financial_hosted.has_live_session()));
CREATE POLICY auth_binding_read ON mwd_financial_hosted.status_bindings FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND active AND (SELECT mwd_financial_hosted.has_live_session()));
CREATE POLICY auth_order_read ON mwd_financial_hosted.order_status_projection FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND (SELECT mwd_financial_hosted.has_live_session())
 AND EXISTS(SELECT 1 FROM mwd_financial_hosted.status_bindings b WHERE b.user_id=order_status_projection.user_id AND b.active)
 AND EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard g WHERE g.environment='sandbox' AND NOT g.live_funds_enabled AND NOT g.provider_dispatch_enabled));
CREATE FUNCTION public.mwd_lab_read_status(p_order uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('mode','sandbox','orderId',o.order_id,'status',o.status,
 'source',jsonb_build_object('currency',o.source_currency,'principalMinor',o.principal_minor::text,'feeMinor',o.fee_minor::text,'totalMinor',o.total_minor::text),
 'destination',jsonb_build_object('currency',o.payout_currency,'amountMinor',o.payout_minor::text),
 'acceptedAt',to_char(o.accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
 FROM mwd_financial_hosted.order_status_projection o WHERE o.order_id=p_order AND o.user_id=(SELECT auth.uid())
 $$;
REVOKE ALL ON FUNCTION public.mwd_lab_read_status(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mwd_lab_read_status(uuid) TO authenticated;
COMMIT;
