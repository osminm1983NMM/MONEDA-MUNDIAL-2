-- Hosted financial staging only; apply only to explicitly authorized empty lab.
-- NOT a production migration, not the disposable CI schema, no provider or ledger activation.
BEGIN;
DO $$
BEGIN
 IF current_database() <> 'postgres' OR to_regclass('auth.users') IS NULL
 OR EXISTS (SELECT 1 FROM auth.users)
 OR EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public')
 OR to_regnamespace('mwd_financial_lab') IS NOT NULL
 OR to_regnamespace('mwd_financial_hosted') IS NOT NULL
 THEN RAISE EXCEPTION 'EMPTY_HOSTED_LAB_REQUIRED'; END IF;
END $$;
CREATE SCHEMA mwd_financial_hosted;
REVOKE ALL ON SCHEMA mwd_financial_hosted FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE mwd_financial_hosted.environment_guard (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 environment text NOT NULL DEFAULT 'sandbox' CHECK(environment='sandbox'),
 live_funds_enabled boolean NOT NULL DEFAULT false CHECK(NOT live_funds_enabled),
 provider_dispatch_enabled boolean NOT NULL DEFAULT false CHECK(NOT provider_dispatch_enabled)
);
INSERT INTO mwd_financial_hosted.environment_guard(singleton) VALUES(true);
CREATE TABLE mwd_financial_hosted.status_bindings (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
-- Future read-only projection of an authoritative order ledger. Never a
-- source of financial truth, nor an order creation/settlement mechanism.
CREATE TABLE mwd_financial_hosted.order_status_projection (
 order_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES mwd_financial_hosted.status_bindings(user_id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('funding_pending','funding_failed','funded','payout_pending','payout_failed','paid','refund_pending','refunded')),
 principal_minor bigint NOT NULL CHECK(principal_minor>0),
 fee_minor bigint NOT NULL CHECK(fee_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor::numeric=principal_minor::numeric+fee_minor::numeric),
 source_currency text NOT NULL DEFAULT 'USD' CHECK(source_currency='USD'),
 payout_minor bigint NOT NULL CHECK(payout_minor>0),
 payout_currency text NOT NULL DEFAULT 'HNL' CHECK(payout_currency='HNL'),
 accepted_at timestamptz(3) NOT NULL CHECK(isfinite(accepted_at)),
 UNIQUE(user_id,order_id)
);
ALTER TABLE mwd_financial_hosted.environment_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_financial_hosted.environment_guard FORCE ROW LEVEL SECURITY;
ALTER TABLE mwd_financial_hosted.status_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_financial_hosted.status_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE mwd_financial_hosted.order_status_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_financial_hosted.order_status_projection FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_hosted FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA mwd_financial_hosted FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mwd_financial_hosted REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mwd_financial_hosted REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
-- No policies or access grants yet. No function, API, test account, or live money.
COMMIT;
