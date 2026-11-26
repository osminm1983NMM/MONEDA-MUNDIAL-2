\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '45s';
SET LOCAL search_path = mwd_financial_lab, pg_catalog;

DO $$ BEGIN
 IF current_database() <> 'mwd_financial_sandbox_test' OR EXISTS (SELECT FROM reservations)
 THEN RAISE EXCEPTION 'EMPTY_RECONCILIATION_LAB_REQUIRED'; END IF;
END $$;

SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM reconciliation_capacity_summary
  WHERE reference_limit=10000 AND references_remaining=10000 AND NOT capacity_exceeded)
 THEN RAISE EXCEPTION 'EMPTY_CAPACITY_MISMATCH'; END IF;
END $$;
RESET ROLE;

-- Build a full-size synthetic fixture in bulk. The statement itself is
-- assembled independently from the fixture identifiers and expected outcomes.
CREATE TEMP TABLE volume_orders ON COMMIT DROP AS
SELECT n, gen_random_uuid() AS order_id, gen_random_uuid() AS quote_id,
       'volume-' || ((n - 1) / 50) AS actor
FROM generate_series(1, 10000) AS rows(n);

INSERT INTO actor_policy
SELECT DISTINCT actor, 'verified', 'clear', 'allow', 1000000 FROM volume_orders;
INSERT INTO beneficiaries SELECT DISTINCT actor, 'volume', 'verified' FROM volume_orders;
INSERT INTO quotes (id, actor, beneficiary_ref, amount_cents, expires_at)
SELECT quote_id, actor, 'volume', 10000, clock_timestamp() + interval '5 minutes'
FROM volume_orders;
INSERT INTO orders (id, actor, request_id, quote_id, beneficiary_ref, amount_cents, state)
SELECT order_id, actor, 'volume-' || n, quote_id::text, 'volume', 10000,
       CASE WHEN n % 2 = 0 THEN 'funded' ELSE 'funding_failed' END
FROM volume_orders;
INSERT INTO reservations
SELECT order_id, quote_id, actor, (clock_timestamp() AT TIME ZONE 'UTC')::date,
       10150, 'sandbox-disclosure-v1', clock_timestamp()
FROM volume_orders;
INSERT INTO outbox
SELECT order_id::text || '-funding', order_id, 'funding', 'USD', 10150 FROM volume_orders;
INSERT INTO inbox
SELECT 'mock-remittance', 'volume-' || n, order_id::text || '-funding',
       CASE WHEN n % 2 = 0 THEN 'confirmed' ELSE 'failed' END, 'USD', 10150
FROM volume_orders;
INSERT INTO journal
SELECT 'mock-remittance', 'volume-' || n, order_id, 10150, -10150, 0
FROM volume_orders WHERE n % 2 = 0;
ANALYZE inbox;
ANALYZE outbox;
ANALYZE reservations;

SELECT set_config('mwd.volume.rows', jsonb_agg(jsonb_build_object(
 'mode', 'sandbox', 'reference', order_id::text || '-funding', 'kind', 'funding',
 'currency', 'USD', 'amountMinor', 10150,
 'status', CASE WHEN n % 2 = 0 THEN 'confirmed' ELSE 'failed' END
) ORDER BY n)::text, true) IS NOT NULL AS built FROM volume_orders;

SET LOCAL ROLE mwd_lab_statement_service;
DO $$
DECLARE rows jsonb := current_setting('mwd.volume.rows')::jsonb;
        stamp timestamptz := clock_timestamp();
        batch uuid;
BEGIN
 batch:=import_statement_cut('volume-cut', 'US-HN:all-funding-payout-refund', stamp, 10000, rows);
 PERFORM set_config('mwd.volume.stamp',stamp::text,true),set_config('mwd.volume.batch',batch::text,true);
 RAISE NOTICE '10,000-row statement import elapsed: % ms',
  round(extract(epoch FROM clock_timestamp() - stamp) * 1000, 1);
END $$;
RESET ROLE;

SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF NOT EXISTS (
  SELECT FROM reconciliation_cut_summary
  WHERE declared_count=10000 AND clean AND discrepancy_count=0
    AND matched_usd_minor=50750000 AND matched_hnl_minor=0
 ) THEN RAISE EXCEPTION 'VOLUME_RECONCILIATION_MISMATCH'; END IF;
 IF NOT EXISTS (SELECT FROM reconciliation_capacity_summary
  WHERE reference_limit=10000 AND references_remaining=0 AND NOT capacity_exceeded)
 THEN RAISE EXCEPTION 'FULL_CAPACITY_MISMATCH'; END IF;
END $$;
RESET ROLE;

-- One more reserved reference makes full-history reconciliation impossible
-- through this bounded envelope. An existing cut remains replayable.
SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('volume-0','volume',10000) \gset extra_
SELECT accept_quote('volume-0','volume-overflow',:'extra_quote_id','sandbox-disclosure-v1');
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
DO $$
DECLARE rows jsonb:=current_setting('mwd.volume.rows')::jsonb;
BEGIN
 BEGIN
  PERFORM import_statement_cut('volume-overflow','US-HN:all-funding-payout-refund',clock_timestamp(),10000,rows);
  RAISE EXCEPTION 'oversized internal universe accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CUT_CAPACITY_EXCEEDED' THEN RAISE; END IF; END;
 IF import_statement_cut('volume-cut','US-HN:all-funding-payout-refund',current_setting('mwd.volume.stamp')::timestamptz,10000,rows)
    IS DISTINCT FROM current_setting('mwd.volume.batch')::uuid
 THEN RAISE EXCEPTION 'original cut replay changed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM reconciliation_capacity_summary
  WHERE reference_limit=10000 AND references_remaining=0 AND capacity_exceeded)
 THEN RAISE EXCEPTION 'OVERFLOW_CAPACITY_MISMATCH'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT FROM statement_batches WHERE external_id='volume-overflow')
 THEN RAISE EXCEPTION 'overflow persisted an invalid statement'; END IF;
END $$;
ROLLBACK;
