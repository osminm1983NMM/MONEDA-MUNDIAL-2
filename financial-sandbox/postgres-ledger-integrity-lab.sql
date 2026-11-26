-- Disposable financial lab. Read-only independent per-order accounting invariants.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
-- Recompute expected balances from the synthetic order lifecycle, not journal totals.
-- Cash, payable and revenue are signed USD minor units.
CREATE VIEW ledger_integrity_details AS
 WITH expected AS (
 SELECT o.id,o.state,
  CASE WHEN o.state='paid' THEN o.fee_cents
       WHEN o.state IN ('funded','payout_pending','payout_failed','refund_pending') THEN o.amount_cents+o.fee_cents
       ELSE 0 END AS expected_cash,
  CASE WHEN o.state IN ('funded','payout_pending','payout_failed','refund_pending') THEN -(o.amount_cents+o.fee_cents)
       ELSE 0 END AS expected_payable,
  CASE WHEN o.state='paid' THEN -o.fee_cents ELSE 0 END AS expected_revenue,
  CASE WHEN o.state IN ('paid','refunded') THEN 2
       WHEN o.state IN ('funded','payout_pending','payout_failed','refund_pending') THEN 1
       ELSE 0 END AS expected_postings
 FROM orders o JOIN reservations z ON z.order_id=o.id
 ), actual AS (
 SELECT j.order_id,sum(j.cash) AS cash,sum(j.payable) AS payable,sum(j.revenue) AS revenue,count(*) AS postings,
 count(*) FILTER(WHERE e.outcome IS DISTINCT FROM 'confirmed' OR x.order_id IS DISTINCT FROM j.order_id
  OR (j.cash,j.payable,j.revenue) IS DISTINCT FROM (
   CASE x.kind WHEN 'funding' THEN o.amount_cents+o.fee_cents WHEN 'payout' THEN -o.amount_cents WHEN 'refund' THEN -(o.amount_cents+o.fee_cents) END,
   CASE x.kind WHEN 'funding' THEN -(o.amount_cents+o.fee_cents) WHEN 'payout' THEN o.amount_cents+o.fee_cents WHEN 'refund' THEN o.amount_cents+o.fee_cents END,
   CASE x.kind WHEN 'payout' THEN -o.fee_cents ELSE 0 END
  ) OR e.currency IS DISTINCT FROM x.currency OR e.amount_minor IS DISTINCT FROM x.amount_minor) AS invalid_postings
 FROM journal j JOIN orders o ON o.id=j.order_id
 LEFT JOIN inbox e ON (e.provider,e.event_id)=(j.provider,j.event_id)
 LEFT JOIN outbox x ON x.reference=e.reference
 GROUP BY j.order_id
 ), coverage AS (
 SELECT x.order_id,count(*) FILTER(WHERE e.outcome='confirmed' AND j.event_id IS NULL) AS missing_postings
 FROM outbox x JOIN inbox e ON e.reference=x.reference
 LEFT JOIN journal j ON (j.provider,j.event_id)=(e.provider,e.event_id) AND j.order_id=x.order_id
 GROUP BY x.order_id
 )
 SELECT e.id AS order_id,e.state,
  (coalesce(a.cash,0),coalesce(a.payable,0),coalesce(a.revenue,0),coalesce(a.postings,0))
  IS DISTINCT FROM (e.expected_cash,e.expected_payable,e.expected_revenue,e.expected_postings) AS balance_mismatch,
  coalesce(a.invalid_postings,0) AS invalid_postings,
  coalesce(c.missing_postings,0) AS missing_postings
 FROM expected e LEFT JOIN actual a ON a.order_id=e.id LEFT JOIN coverage c ON c.order_id=e.id;
CREATE VIEW ledger_integrity_summary AS
 SELECT count(*) AS orders_checked,
 count(*) FILTER(WHERE balance_mismatch OR invalid_postings>0 OR missing_postings>0) AS orders_with_anomalies,
 count(*) FILTER(WHERE balance_mismatch) AS balance_mismatches,
 coalesce(sum(invalid_postings),0) AS invalid_postings,
 coalesce(sum(missing_postings),0) AS missing_postings
 FROM ledger_integrity_details;
REVOKE ALL ON ledger_integrity_details,ledger_integrity_summary FROM PUBLIC;
GRANT SELECT ON ledger_integrity_summary TO mwd_lab_audit_service;
COMMIT;
