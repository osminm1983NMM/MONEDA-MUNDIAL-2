-- Moneda Mundial DEMO: auditoría de invariantes (SOLO LECTURA).
-- Ejecutar con rol autorizado. No inserta, actualiza ni elimina datos.
-- Un resultado > 0 en cualquier columna de anomalías requiere investigación.
WITH wallet_movements AS (
  SELECT source_user_id AS user_id, -amount_cents AS delta_cents
  FROM public.mwd_operations
  UNION ALL
  SELECT destination_user_id AS user_id, amount_cents AS delta_cents
  FROM public.mwd_operations
  WHERE kind = 'transfer' AND destination_user_id IS NOT NULL
),
wallet_totals AS (
  SELECT user_id, sum(delta_cents) AS delta_cents
  FROM wallet_movements GROUP BY user_id
),
journal_groups AS (
  SELECT conversion_id, asset_code, count(*) AS entries, sum(delta_micro) AS net_micro
  FROM mwd_swap_private.demo_journal
  GROUP BY conversion_id, asset_code
),
conversion_groups AS (
  SELECT c.id, count(j.asset_code) AS asset_groups
  FROM mwd_swap_private.demo_conversions c
  LEFT JOIN journal_groups j ON j.conversion_id = c.id
  GROUP BY c.id
),
payment_matches AS (
  SELECT p.id, p.status,
         count(o.id) AS operation_count,
         count(o.id) FILTER (
           WHERE o.kind = 'transfer'
             AND o.destination_user_id = p.merchant_user_id
             AND o.amount_cents = p.amount_cents
         ) AS valid_operation_count
  FROM public.mwd_payment_requests p
  LEFT JOIN public.mwd_operations o ON o.request_id = p.id
  GROUP BY p.id, p.status
)
SELECT
  (SELECT count(*) FROM public.mwd_wallets) AS wallets_checked,
  (SELECT count(*) FROM public.mwd_wallets w
     LEFT JOIN wallet_totals t ON t.user_id = w.user_id
     WHERE w.balance_cents <> 1000000 + coalesce(t.delta_cents, 0)
  ) AS wallet_balance_mismatches,
  (SELECT count(*) FROM public.mwd_wallets WHERE balance_cents < 0) AS negative_wallets,
  (SELECT count(*) FROM (
    SELECT actor_id, request_id FROM public.mwd_operations
    GROUP BY actor_id, request_id HAVING count(*) > 1
  ) d) AS duplicate_operation_requests,
  (SELECT count(*) FROM journal_groups WHERE entries <> 2 OR net_micro <> 0)
    AS unbalanced_conversion_asset_groups,
  (SELECT count(*) FROM conversion_groups WHERE asset_groups <> 2)
    AS incomplete_conversion_journals,
  (SELECT count(*) FROM mwd_swap_private.demo_quotes q
     WHERE q.status = 'executed' AND NOT EXISTS (
       SELECT 1 FROM mwd_swap_private.demo_conversions c WHERE c.quote_id = q.id
     )
  ) AS executed_quotes_without_conversion,
  (SELECT count(*) FROM payment_matches
     WHERE (status = 'paid' AND (operation_count <> 1 OR valid_operation_count <> 1))
        OR (status <> 'paid' AND operation_count <> 0)
  ) AS payment_reconciliation_errors;
-- Importante: la conciliación de billeteras presupone saldo inicial de 1,000,000
-- centavos y ausencia de ajustes no reflejados en mwd_operations.
