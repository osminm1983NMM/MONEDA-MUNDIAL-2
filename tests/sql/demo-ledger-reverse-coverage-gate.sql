-- DEMO only: reverse ledger coverage and balance reconciliation against configured opening.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $gate$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.mwd_wallets) OR NOT EXISTS (SELECT 1 FROM public.mwd_operations) THEN RAISE EXCEPTION 'Missing demo fixtures'; END IF;
 IF EXISTS (
 SELECT 1 FROM mwd_finance_private.ledger_transactions t
 WHERE t.currency_code='MWD' AND (t.status IS DISTINCT FROM 'posted' OR NOT EXISTS (
 SELECT 1 FROM public.mwd_operations o WHERE t.external_reference=(CASE WHEN o.kind='transfer' THEN 'mwd-demo-transfer:' WHEN o.kind='contribution' THEN 'mwd-demo-contribution:' END)||o.id))
 ) THEN RAISE EXCEPTION 'Unposted or orphan MWD transaction'; END IF;
 IF EXISTS (SELECT 1 FROM mwd_finance_private.ledger_entries e LEFT JOIN mwd_finance_private.ledger_transactions t ON t.id=e.transaction_id LEFT JOIN mwd_finance_private.ledger_accounts a ON a.id=e.account_id WHERE t.id IS NULL OR a.id IS NULL OR t.currency_code IS DISTINCT FROM a.currency_code) THEN RAISE EXCEPTION 'Orphan or currency-mismatched entry'; END IF;
 IF EXISTS (SELECT 1 FROM mwd_finance_private.ledger_accounts a WHERE a.currency_code='MWD' AND a.account_type='customer_liability' AND NOT EXISTS (SELECT 1 FROM public.mwd_wallets w WHERE w.user_id=a.owner_user_id)) THEN RAISE EXCEPTION 'MWD customer account without wallet'; END IF;
 IF EXISTS (
 SELECT w.user_id FROM public.mwd_wallets w LEFT JOIN mwd_finance_private.ledger_accounts a ON a.owner_user_id=w.user_id AND a.currency_code='MWD' AND a.account_type='customer_liability' LEFT JOIN mwd_finance_private.ledger_entries e ON e.account_id=a.id LEFT JOIN mwd_finance_private.ledger_transactions t ON t.id=e.transaction_id
 GROUP BY w.user_id,w.balance_cents
 HAVING w.balance_cents IS DISTINCT FROM (1000000::numeric+coalesce(sum(CASE WHEN e.entry_side='credit' THEN e.amount_minor WHEN e.entry_side='debit' THEN -e.amount_minor ELSE 0 END) FILTER (WHERE t.status='posted' AND t.currency_code='MWD'),0))
 ) THEN RAISE EXCEPTION 'Wallet differs from configured demo opening plus ledger movements'; END IF;
END $gate$;
SELECT (SELECT count(*) FROM public.mwd_wallets) AS wallets_checked,(SELECT count(*) FROM mwd_finance_private.ledger_transactions WHERE currency_code='MWD') AS mwd_transactions,(SELECT count(*) FROM mwd_finance_private.ledger_entries e JOIN mwd_finance_private.ledger_transactions t ON t.id=e.transaction_id WHERE t.currency_code='MWD') AS mwd_entries;
ROLLBACK;
