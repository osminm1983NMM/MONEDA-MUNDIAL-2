-- Moneda Mundial 2.0: conciliacion de movimientos ficticios, solo lectura.
-- Las transferencias redistribuyen saldo; las aportaciones lo reducen.
WITH movements AS (
 SELECT source_user_id AS user_id, -amount_cents AS delta_cents
 FROM public.mwd_operations WHERE source_user_id IS NOT NULL
 UNION ALL
 SELECT destination_user_id AS user_id, amount_cents AS delta_cents
 FROM public.mwd_operations
 WHERE kind='transfer' AND destination_user_id IS NOT NULL
), net AS (
 SELECT user_id, sum(delta_cents) AS net_delta_cents
 FROM movements GROUP BY user_id
), per_wallet AS (
 SELECT w.user_id,w.balance_cents,coalesce(n.net_delta_cents,0) AS net_delta_cents,
 w.balance_cents-coalesce(n.net_delta_cents,0) AS implied_opening_cents
 FROM public.mwd_wallets w LEFT JOIN net n ON n.user_id=w.user_id
)
SELECT count(*) AS wallet_count,
 sum(balance_cents) AS current_total_cents,
 sum(net_delta_cents) AS recorded_net_delta_cents,
 sum(implied_opening_cents) AS implied_opening_total_cents,
 count(*) FILTER (WHERE implied_opening_cents<0) AS negative_implied_opening_balances,
 (SELECT count(*) FROM net n LEFT JOIN public.mwd_wallets w ON w.user_id=n.user_id WHERE w.user_id IS NULL) AS movements_without_wallet
FROM per_wallet;

-- LIMITACION CRITICA: implied_opening_cents es un saldo inferido, NO un
-- saldo inicial auditado. Para probar reconciliacion historica se necesita
-- un asiento de apertura o un registro de provisionamiento verificable.
