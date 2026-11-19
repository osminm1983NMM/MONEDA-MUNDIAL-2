-- Moneda Mundial 2.0 | Preflight de migración del fondo social ficticio
-- SOLO LECTURA. Ejecutar antes de aprobar cualquier DDL, backfill o despliegue.
-- No requiere rama de Supabase. No imprime datos personales.
WITH
  operations AS (
    SELECT count(*) FILTER (WHERE kind='transfer') AS transfers,
           count(*) FILTER (WHERE kind='contribution') AS contributions,
           coalesce(sum(amount_cents) FILTER (WHERE kind='contribution'),0) AS contribution_minor,
           count(*) FILTER (WHERE kind='contribution' AND
             (amount_cents IS NULL OR amount_cents <= 0 OR source_user_id IS NULL
              OR destination_user_id IS NOT NULL OR actor_id IS DISTINCT FROM source_user_id)) AS invalid_contributions
    FROM public.mwd_operations
  ),
  duplicates AS (
    SELECT count(*) AS duplicate_requests FROM (
      SELECT actor_id,request_id FROM public.mwd_operations
      WHERE request_id IS NOT NULL
      GROUP BY actor_id,request_id HAVING count(*) > 1
    ) d
  ),
  ledger AS (
    SELECT count(*) FILTER (WHERE transaction_kind='wallet_transfer' AND status='posted') AS posted_transfers,
           count(*) FILTER (WHERE transaction_kind='contribution') AS contribution_ledger_rows
    FROM mwd_finance_private.ledger_transactions
  ),
  existing_fund AS (
    SELECT count(*) AS matching_code,
           count(*) FILTER (WHERE owner_user_id IS NULL AND currency_code='MWD'
                            AND account_type='social_fund') AS correctly_classified
    FROM mwd_finance_private.ledger_accounts
    WHERE account_code='MWD-DEMO-SOCIAL-FUND'
  ),
  constraints AS (
    SELECT count(*) FILTER (WHERE conname='ledger_accounts_account_type_check') AS account_type_checks,
           count(*) FILTER (WHERE conname='ledger_transactions_transaction_kind_check') AS transaction_kind_checks
    FROM pg_constraint
    WHERE conrelid IN ('mwd_finance_private.ledger_accounts'::regclass,
                       'mwd_finance_private.ledger_transactions'::regclass)
  )
SELECT operations.*, duplicates.*, ledger.*, existing_fund.*, constraints.*,
       (SELECT count(*) FROM public.mwd_wallets WHERE balance_cents < 0) AS negative_wallets,
       (SELECT count(*) FROM pg_trigger
        WHERE tgrelid='public.mwd_operations'::regclass
          AND tgname='mwd_auto_ledger_contribution_v1' AND NOT tgisinternal) AS contribution_trigger_present
FROM operations CROSS JOIN duplicates CROSS JOIN ledger CROSS JOIN existing_fund CROSS JOIN constraints;
-- Interpretación: antes de migrar se espera contribution_trigger_present=0,
-- contribution_ledger_rows=0, matching_code=0 y checks=1 cada uno.
-- Si matching_code=1 pero correctly_classified=0: DETENER despliegue.
-- La conciliación completa y los tests de Android siguen siendo independientes.
