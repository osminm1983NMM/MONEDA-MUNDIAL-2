-- Independent hosted LAB only. No wallet balances, writes or provider calls.
-- The caller must separately authorize the wallet account. This RPC attests
-- only the currently authenticated and live LAB identity.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard WHERE environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled)
 OR to_regprocedure('mwd_financial_hosted.has_live_session()') IS NULL
 THEN RAISE EXCEPTION 'ISOLATED_LAB_REQUIRED'; END IF;
END $$;
CREATE FUNCTION public.mwd_lab_session_identity() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('environment','sandbox','actor',b.user_id::text)
 FROM mwd_financial_hosted.status_bindings b
 WHERE b.user_id=(SELECT auth.uid()) AND b.active
 AND (SELECT mwd_financial_hosted.has_live_session())
 AND EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard g
  WHERE g.environment='sandbox' AND NOT g.live_funds_enabled AND NOT g.provider_dispatch_enabled)
$$;
REVOKE ALL ON FUNCTION public.mwd_lab_session_identity() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mwd_lab_session_identity() TO authenticated;
COMMIT;
