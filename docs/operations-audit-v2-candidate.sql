-- Candidate only: do not deploy automatically. Rehearse on disposable PostgreSQL.
-- Preserve v1: older consumers may rely on its pre-posting classification.
-- The proposed v2 checks exact accounts, amounts, transaction identity and posting.
BEGIN;
DO $guard$ BEGIN
 IF current_database() <> 'mwd_demo_isolated' OR
 (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY'
 THEN RAISE EXCEPTION 'Refusing non-disposable database'; END IF;
END $guard$;
CREATE VIEW mwd_finance_private.demo_operations_audit_v2 WITH (security_invoker=true) AS
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
SELECT operation_id,kind,created_at,amount_cents,audit_status FROM checked;
REVOKE ALL ON mwd_finance_private.demo_operations_audit_v2 FROM PUBLIC,anon,authenticated;
DO $gate$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM mwd_finance_private.demo_operations_audit_v2) THEN RAISE EXCEPTION 'Missing fixtures'; END IF;
 IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_operations_audit_v2 WHERE audit_status IS DISTINCT FROM 'ok') THEN RAISE EXCEPTION 'Invalid ledger posting'; END IF;
END $gate$;
SELECT kind,audit_status,count(*) FROM mwd_finance_private.demo_operations_audit_v2 GROUP BY 1,2 ORDER BY 1,2;
-- Negative control: intentionally perturb one synthetic debit account only in this
-- guarded disposable transaction. Verify the exact-account audit catches it,
-- then undo the perturbation before checking the clean baseline again.
SAVEPOINT negative_control;
DO $negative$
DECLARE op_id uuid; account_id_to_test uuid; detected text;
BEGIN
 SELECT o.id,a.id INTO STRICT op_id,account_id_to_test
 FROM public.mwd_operations o
 JOIN mwd_finance_private.ledger_accounts a ON a.owner_user_id=o.source_user_id
   AND a.currency_code='MWD' AND a.account_type='customer_liability'
 WHERE o.kind='transfer'
 ORDER BY o.id LIMIT 1;
 UPDATE mwd_finance_private.ledger_accounts
 SET account_code='MWD-ISOLATED-NEGATIVE-'||id::text
 WHERE id=account_id_to_test;
 SELECT audit_status INTO STRICT detected
 FROM mwd_finance_private.demo_operations_audit_v2 WHERE operation_id=op_id;
 IF detected IS DISTINCT FROM 'invalid_debit' THEN
   RAISE EXCEPTION 'Negative control missed invalid debit account: %', detected;
 END IF;
END $negative$;
ROLLBACK TO SAVEPOINT negative_control;
DO $restored$
BEGIN
 IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_operations_audit_v2 WHERE audit_status IS DISTINCT FROM 'ok')
 THEN RAISE EXCEPTION 'Negative control did not restore clean baseline'; END IF;
 IF has_table_privilege('anon','mwd_finance_private.demo_operations_audit_v2','SELECT')
 OR has_table_privilege('authenticated','mwd_finance_private.demo_operations_audit_v2','SELECT')
 THEN RAISE EXCEPTION 'Audit view exposed to client'; END IF;
END $restored$;
ROLLBACK;
