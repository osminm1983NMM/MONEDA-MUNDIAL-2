-- Independent hosted LAB: immutable point-in-time wallet projections only.
-- Never use this table as a live ledger, payment authority or reserve proof.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard WHERE environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled)
 OR to_regprocedure('public.mwd_lab_session_identity()') IS NULL
 THEN RAISE EXCEPTION 'ISOLATED_LAB_REQUIRED'; END IF;
END $$;
CREATE TABLE mwd_financial_hosted.wallet_snapshot (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 exported_at timestamptz NOT NULL CHECK(isfinite(exported_at)),
 source_manifest_sha256 text NOT NULL CHECK(source_manifest_sha256 ~ '^[a-f0-9]{64}$'),
 source_event_count integer NOT NULL CHECK(source_event_count BETWEEN 0 AND 2000),
 portfolio jsonb NOT NULL CHECK(jsonb_typeof(portfolio)='object' AND portfolio->>'mode'='sandbox'
  AND portfolio ?& ARRAY['mode','assets','pendingRedemptionUsdMinor','conversions']
  AND (portfolio - ARRAY['mode','assets','pendingRedemptionUsdMinor','conversions'])='{}'::jsonb
  AND octet_length(portfolio::text)<=1048576)
);
ALTER TABLE mwd_financial_hosted.wallet_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_financial_hosted.wallet_snapshot FORCE ROW LEVEL SECURITY;
REVOKE ALL ON mwd_financial_hosted.wallet_snapshot FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(user_id,exported_at,portfolio) ON mwd_financial_hosted.wallet_snapshot TO authenticated;
CREATE POLICY own_live_wallet_snapshot ON mwd_financial_hosted.wallet_snapshot FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND (SELECT mwd_financial_hosted.has_live_session())
 AND EXISTS(SELECT 1 FROM mwd_financial_hosted.status_bindings b WHERE b.user_id=wallet_snapshot.user_id AND b.active)
 AND EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard g WHERE g.environment='sandbox' AND NOT g.live_funds_enabled AND NOT g.provider_dispatch_enabled));
CREATE FUNCTION mwd_financial_hosted.reject_wallet_snapshot_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_WALLET_SNAPSHOT'; END $$;
REVOKE ALL ON FUNCTION mwd_financial_hosted.reject_wallet_snapshot_mutation() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable_wallet_snapshot BEFORE UPDATE OR DELETE OR TRUNCATE ON mwd_financial_hosted.wallet_snapshot
 FOR EACH STATEMENT EXECUTE FUNCTION mwd_financial_hosted.reject_wallet_snapshot_mutation();
CREATE FUNCTION public.mwd_lab_read_wallet_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('kind','immutable_wallet_snapshot','exportedAt',
  to_char(w.exported_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'portfolio',w.portfolio)
 FROM mwd_financial_hosted.wallet_snapshot w WHERE w.user_id=(SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION public.mwd_lab_read_wallet_snapshot() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mwd_lab_read_wallet_snapshot() TO authenticated;
COMMIT;
