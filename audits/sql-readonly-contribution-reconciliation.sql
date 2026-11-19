-- READ-ONLY: reconciliation report for MWD fictional contributions.
-- Safe to run before and after an approved deployment; does not mutate data.
WITH contributions AS (
 SELECT id,source_user_id,actor_id,destination_user_id,amount_cents
 FROM public.mwd_operations WHERE kind='contribution'
), matched AS (
 SELECT o.*,t.id AS ledger_id,t.status,t.transaction_kind,t.currency_code,
        COALESCE(SUM(e.amount_minor) FILTER(WHERE e.entry_side='debit'),0) AS debits,
        COALESCE(SUM(e.amount_minor) FILTER(WHERE e.entry_side='credit'),0) AS credits,
        COUNT(e.id) AS entry_count,
        COUNT(e.id) FILTER(WHERE e.entry_side='debit' AND a.owner_user_id=o.source_user_id AND a.account_type='customer_liability') AS source_debits,
        COUNT(e.id) FILTER(WHERE e.entry_side='credit' AND a.account_code='MWD-DEMO-SOCIAL-FUND' AND a.account_type='social_fund') AS fund_credits
 FROM contributions o
 LEFT JOIN mwd_finance_private.ledger_transactions t
   ON t.external_reference='mwd-demo-contribution:'||o.id::text
 LEFT JOIN mwd_finance_private.ledger_entries e ON e.transaction_id=t.id
 LEFT JOIN mwd_finance_private.ledger_accounts a ON a.id=e.account_id
 GROUP BY o.id,o.source_user_id,o.actor_id,o.destination_user_id,o.amount_cents,
          t.id,t.status,t.transaction_kind,t.currency_code
)
SELECT COUNT(*) contributions,
 COALESCE(SUM(amount_cents),0) total_contribution_cents,
 COUNT(*) FILTER(WHERE ledger_id IS NOT NULL) ledger_matches,
 COUNT(*) FILTER(WHERE ledger_id IS NULL) missing_ledger,
 COUNT(*) FILTER(WHERE ledger_id IS NOT NULL AND
  (status<>'posted' OR transaction_kind<>'contribution' OR currency_code<>'MWD'
   OR debits<>amount_cents OR credits<>amount_cents OR entry_count<>2
   OR source_debits<>1 OR fund_credits<>1)) ledger_mismatches,
 COUNT(*) FILTER(WHERE actor_id IS DISTINCT FROM source_user_id
   OR destination_user_id IS NOT NULL OR amount_cents<=0) invalid_operations
FROM matched;
