-- Disposable sandbox only. Validate order lifecycle, reservations and transport intents.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE VIEW lifecycle_integrity_details AS
WITH expected AS (
 SELECT o.id,o.state,
  (z.actor,z.quote_id::text,z.total_cents,z.reserved_day) IS DISTINCT FROM
  (o.actor,o.quote_id,o.amount_cents+o.fee_cents,(z.accepted_at AT TIME ZONE 'UTC')::date)
  OR (q.actor,q.beneficiary_ref,q.amount_cents) IS DISTINCT FROM (o.actor,o.beneficiary_ref,o.amount_cents)
  OR z.accepted_at>=q.expires_at AS reservation_mismatch,
  CASE WHEN o.state='funding_pending' THEN 'pending' WHEN o.state='funding_failed' THEN 'failed' ELSE 'confirmed' END AS funding_status,
  CASE WHEN o.state IN ('funding_pending','funding_failed','funded') THEN 'absent'
   WHEN o.state='payout_pending' THEN 'pending' WHEN o.state='paid' THEN 'confirmed' ELSE 'failed' END AS payout_status,
  CASE WHEN o.state='refund_pending' THEN 'pending' WHEN o.state='refunded' THEN 'confirmed' ELSE 'absent' END AS refund_status,
  o.amount_cents+o.fee_cents AS funding_amount,o.payout_minor AS payout_amount
 FROM orders o JOIN reservations z ON z.order_id=o.id JOIN quotes q ON q.id=z.quote_id
), legs AS (
 SELECT e.id,e.state,e.reservation_mismatch,k.kind,k.expected_status,k.expected_amount,k.expected_currency
 FROM expected e CROSS JOIN LATERAL (VALUES
 ('funding',e.funding_status,e.funding_amount,'USD'),
 ('payout',e.payout_status,e.payout_amount,'HNL'),
 ('refund',e.refund_status,e.funding_amount,'USD')) k(kind,expected_status,expected_amount,expected_currency)
), observed AS (
 SELECT l.*,x.reference,d.reference AS dispatch_reference,x.amount_minor,x.currency,
 (SELECT count(*) FROM inbox i WHERE i.reference=x.reference) AS event_count,
 (SELECT count(*) FROM inbox i WHERE i.reference=x.reference AND i.outcome=l.expected_status
  AND i.currency=l.expected_currency AND i.amount_minor=l.expected_amount) AS matching_events
 FROM legs l LEFT JOIN outbox x ON x.order_id=l.id AND x.kind=l.kind
 LEFT JOIN dispatch d ON d.reference=x.reference
)
SELECT id AS order_id,state,reservation_mismatch,
 count(*) FILTER(WHERE CASE WHEN expected_status='absent' THEN reference IS NOT NULL
  ELSE reference IS NULL OR dispatch_reference IS NULL OR
   (amount_minor,currency) IS DISTINCT FROM (expected_amount,expected_currency) END) AS intent_mismatches,
 count(*) FILTER(WHERE CASE WHEN expected_status IN ('absent','pending') THEN event_count<>0
  ELSE event_count<>1 OR matching_events<>1 END) AS event_mismatches
FROM observed GROUP BY id,state,reservation_mismatch;
CREATE VIEW lifecycle_integrity_summary AS
SELECT count(*) AS orders_checked,
 count(*) FILTER(WHERE reservation_mismatch OR intent_mismatches>0 OR event_mismatches>0) AS orders_with_anomalies,
 count(*) FILTER(WHERE reservation_mismatch) AS reservation_mismatches,
 coalesce(sum(intent_mismatches),0) AS intent_mismatches,
 coalesce(sum(event_mismatches),0) AS event_mismatches
FROM lifecycle_integrity_details;
REVOKE ALL ON lifecycle_integrity_details,lifecycle_integrity_summary FROM PUBLIC;
GRANT SELECT ON lifecycle_integrity_summary TO mwd_lab_audit_service;
COMMIT;
