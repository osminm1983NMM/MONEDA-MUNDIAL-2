-- Disposable lab only: harden search path and future object defaults.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=pg_catalog,mwd_financial_lab,pg_temp;
-- A separate guard for a new transport submission, not for lookup/ack recovery.
-- Synthetic quote policy only; never infer real provider terms from this rule.
CREATE FUNCTION check_dispatch_submission(p_ref text,p_token uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $
 SELECT check_dispatch_lease(p_ref,p_token) AND EXISTS(
 SELECT FROM outbox x JOIN reservations z ON z.order_id=x.order_id
 JOIN quotes q ON q.id=z.quote_id AND q.actor=z.actor
 WHERE x.reference=p_ref AND (x.kind<>'funding' OR q.expires_at>clock_timestamp()));
$;
REVOKE ALL ON FUNCTION check_dispatch_submission(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_dispatch_submission(text,uuid) TO mwd_lab_dispatch_service;
-- Explicitly put the trusted catalog and schema before the session temporary schema.
DO $$ DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS args
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='mwd_financial_lab' AND p.prokind='f' LOOP
  EXECUTE format('ALTER FUNCTION mwd_financial_lab.%I(%s) SET search_path TO pg_catalog,mwd_financial_lab,pg_temp',f.proname,f.args);
 END LOOP;
END $$;
REVOKE TEMPORARY ON DATABASE mwd_financial_sandbox_test FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA mwd_financial_lab FROM PUBLIC;
-- Functions default to PUBLIC EXECUTE unless globally revoked for their creator.
-- This applies only to the owner of the disposable database's future objects.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
