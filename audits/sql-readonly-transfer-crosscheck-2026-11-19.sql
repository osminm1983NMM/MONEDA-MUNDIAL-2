-- Moneda Mundial 2.0 | Auditoria cruzada de transferencias ficticias
-- SOLO LECTURA: no cambia saldos, operaciones ni libro mayor.
WITH transfer_ops AS (
  SELECT id, source_user_id, destination_user_id, amount_cents
  FROM public.mwd_operations WHERE kind='transfer'
), ledger AS (
  SELECT o.id AS operation_id, o.amount_cents,
         o.source_user_id, o.destination_user_id,
         t.id AS transaction_id, t.status,
         count(e.transaction_id) AS entry_count,
         coalesce(sum(e.amount_minor) FILTER (WHERE e.entry_side='debit'),0) AS debit_minor,
         coalesce(sum(e.amount_minor) FILTER (WHERE e.entry_side='credit'),0) AS credit_minor,
         count(e.transaction_id) FILTER (
           WHERE e.entry_side='debit' AND a.owner_user_id=o.source_user_id
             AND a.account_type='customer_liability' AND a.currency_code='MWD') AS source_debits,
         count(e.transaction_id) FILTER (
           WHERE e.entry_side='credit' AND a.owner_user_id=o.destination_user_id
             AND a.account_type='customer_liability' AND a.currency_code='MWD') AS destination_credits
  FROM transfer_ops o
  LEFT JOIN mwd_finance_private.ledger_transactions t
    ON t.external_reference='mwd-demo-transfer:'||o.id::text
  LEFT JOIN mwd_finance_private.ledger_entries e ON e.transaction_id=t.id
  LEFT JOIN mwd_finance_private.ledger_accounts a ON a.id=e.account_id
  GROUP BY o.id,o.amount_cents,o.source_user_id,o.destination_user_id,t.id,t.status
)
SELECT count(*) AS transfer_operations,
       count(*) FILTER (WHERE transaction_id IS NULL) AS missing_ledger,
       count(*) FILTER (WHERE status IS DISTINCT FROM 'posted') AS not_posted,
       count(*) FILTER (WHERE entry_count<>2) AS wrong_entry_count,
       count(*) FILTER (WHERE debit_minor<>amount_cents OR credit_minor<>amount_cents) AS amount_mismatch,
       count(*) FILTER (WHERE source_debits<>1 OR destination_credits<>1) AS wrong_account_direction,
       (SELECT count(*) FROM mwd_finance_private.ledger_transactions t
        WHERE t.transaction_kind='wallet_transfer'
          AND NOT EXISTS (
            SELECT 1 FROM transfer_ops o
            WHERE t.external_reference='mwd-demo-transfer:'||o.id::text
          )) AS orphan_transfer_ledger
FROM ledger;
