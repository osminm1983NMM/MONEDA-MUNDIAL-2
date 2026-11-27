-- DEMO only. Validate exact posting identity, not just balanced sums.
BEGIN TRANSACTION READ ONLY;
DO $gate$
BEGIN
 IF EXISTS (SELECT 1 FROM public.mwd_operations) IS FALSE THEN RAISE EXCEPTION 'DEMO gate: no operation fixtures'; END IF;
 IF EXISTS (
WITH checked AS (
 SELECT o.id AS operation_id, o.kind, o.created_at, o.amount_cents,
 CASE
 WHEN o.actor_id IS NULL OR o.request_id IS NULL OR o.amount_cents IS NULL OR o.amount_cents<=0 OR o.source_user_id IS DISTINCT FROM o.actor_id THEN 'invalid_basic'
 WHEN o.kind='transfer' AND (o.destination_user_id IS NULL OR o.source_user_id=o.destination_user_id) THEN 'invalid_transfer'
 WHEN o.kind='contribution' AND o.destination_user_id IS NOT NULL THEN 'invalid_contribution'
 WHEN o.kind NOT IN ('transfer','contribution') OR o.kind IS NULL THEN 'unsupported_kind'
 WHEN count(DISTINCT t.id)=0 THEN 'missing_ledger'
 WHEN count(DISTINCT t.id)<>1 THEN 'duplicate_ledger'
 WHEN bool_or(t.status IS DISTINCT FROM 'posted' OR t.currency_code IS DISTINCT FROM 'MWD' OR t.transaction_kind IS DISTINCT FROM CASE WHEN o.kind='transfer' THEN 'wallet_transfer' ELSE 'demo_contribution' END) THEN 'invalid_ledger_header'
 WHEN count(e.id)<>2 THEN 'wrong_entry_count'
 WHEN count(*) FILTER (WHERE e.entry_side='debit' AND e.amount_minor=o.amount_cents AND a.currency_code='MWD' AND a.account_type='customer_liability' AND a.owner_user_id=o.source_user_id AND a.account_code='MWD-DEMO-USER-'||o.source_user_id)<>1 THEN 'invalid_debit'
 WHEN count(*) FILTER (WHERE e.entry_side='credit' AND e.amount_minor=o.amount_cents AND a.currency_code='MWD' AND ((o.kind='transfer' AND a.account_type='customer_liability' AND a.owner_user_id=o.destination_user_id AND a.account_code='MWD-DEMO-USER-'||o.destination_user_id) OR (o.kind='contribution' AND a.account_type='suspense' AND a.owner_user_id IS NULL AND a.account_code='MWD-DEMO-CONTRIBUTION-CLEARING')))<>1 THEN 'invalid_credit'
 ELSE 'ok' END AS audit_status
 FROM public.mwd_operations o
 LEFT JOIN mwd_finance_private.ledger_transactions t ON t.external_reference=(CASE WHEN o.kind='transfer' THEN 'mwd-demo-transfer:' ELSE 'mwd-demo-contribution:' END)||o.id
 LEFT JOIN mwd_finance_private.ledger_entries e ON e.transaction_id=t.id
 LEFT JOIN mwd_finance_private.ledger_accounts a ON a.id=e.account_id
 GROUP BY o.id,o.kind,o.created_at,o.amount_cents,o.actor_id,o.request_id,o.source_user_id,o.destination_user_id
)
SELECT 1 FROM checked WHERE audit_status IS DISTINCT FROM 'ok'
 ) THEN RAISE EXCEPTION 'DEMO ledger identity or posting mismatch'; END IF;
END $gate$;
WITH checked AS (
 SELECT o.id AS operation_id, o.kind, o.created_at, o.amount_cents,
 CASE
 WHEN o.actor_id IS NULL OR o.request_id IS NULL OR o.amount_cents IS NULL OR o.amount_cents<=0 OR o.source_user_id IS DISTINCT FROM o.actor_id THEN 'invalid_basic'
 WHEN o.kind='transfer' AND (o.destination_user_id IS NULL OR o.source_user_id=o.destination_user_id) THEN 'invalid_transfer'
 WHEN o.kind='contribution' AND o.destination_user_id IS NOT NULL THEN 'invalid_contribution'
 WHEN o.kind NOT IN ('transfer','contribution') OR o.kind IS NULL THEN 'unsupported_kind'
 WHEN count(DISTINCT t.id)=0 THEN 'missing_ledger'
 WHEN count(DISTINCT t.id)<>1 THEN 'duplicate_ledger'
 WHEN bool_or(t.status IS DISTINCT FROM 'posted' OR t.currency_code IS DISTINCT FROM 'MWD' OR t.transaction_kind IS DISTINCT FROM CASE WHEN o.kind='transfer' THEN 'wallet_transfer' ELSE 'demo_contribution' END) THEN 'invalid_ledger_header'
 WHEN count(e.id)<>2 THEN 'wrong_entry_count'
 WHEN count(*) FILTER (WHERE e.entry_side='debit' AND e.amount_minor=o.amount_cents AND a.currency_code='MWD' AND a.account_type='customer_liability' AND a.owner_user_id=o.source_user_id AND a.account_code='MWD-DEMO-USER-'||o.source_user_id)<>1 THEN 'invalid_debit'
 WHEN count(*) FILTER (WHERE e.entry_side='credit' AND e.amount_minor=o.amount_cents AND a.currency_code='MWD' AND ((o.kind='transfer' AND a.account_type='customer_liability' AND a.owner_user_id=o.destination_user_id AND a.account_code='MWD-DEMO-USER-'||o.destination_user_id) OR (o.kind='contribution' AND a.account_type='suspense' AND a.owner_user_id IS NULL AND a.account_code='MWD-DEMO-CONTRIBUTION-CLEARING')))<>1 THEN 'invalid_credit'
 ELSE 'ok' END AS audit_status
 FROM public.mwd_operations o
 LEFT JOIN mwd_finance_private.ledger_transactions t ON t.external_reference=(CASE WHEN o.kind='transfer' THEN 'mwd-demo-transfer:' ELSE 'mwd-demo-contribution:' END)||o.id
 LEFT JOIN mwd_finance_private.ledger_entries e ON e.transaction_id=t.id
 LEFT JOIN mwd_finance_private.ledger_accounts a ON a.id=e.account_id
 GROUP BY o.id,o.kind,o.created_at,o.amount_cents,o.actor_id,o.request_id,o.source_user_id,o.destination_user_id
)
SELECT kind,audit_status,count(*) AS operations FROM checked GROUP BY kind,audit_status ORDER BY kind,audit_status;
ROLLBACK;
