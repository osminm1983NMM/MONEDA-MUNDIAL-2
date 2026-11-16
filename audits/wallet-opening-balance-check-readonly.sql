-- Moneda Mundial DEMO: contraste de saldos de apertura inferidos.
-- SOLO LECTURA; no revela IDs de usuarios.
-- El valor 1000000 centavos es el default observado de public.mwd_wallets.balance_cents
-- al realizar esta revision. Confirmar de nuevo si cambia el esquema.
WITH movements AS (
 SELECT source_user_id AS user_id, -amount_cents AS delta_cents
 FROM public.mwd_operations WHERE source_user_id IS NOT NULL
 UNION ALL
 SELECT destination_user_id AS user_id, amount_cents AS delta_cents
 FROM public.mwd_operations WHERE kind='transfer' AND destination_user_id IS NOT NULL
), net AS (
 SELECT user_id,sum(delta_cents) AS net_delta_cents FROM movements GROUP BY user_id
), implied AS (
 SELECT w.balance_cents-coalesce(n.net_delta_cents,0) AS implied_opening_cents
 FROM public.mwd_wallets w LEFT JOIN net n ON n.user_id=w.user_id
)
SELECT count(*) AS wallet_count,
 count(*) FILTER (WHERE implied_opening_cents=1000000) AS matching_default,
 count(*) FILTER (WHERE implied_opening_cents<>1000000) AS not_matching_default,
 min(implied_opening_cents) AS min_implied_opening,
 max(implied_opening_cents) AS max_implied_opening
FROM implied;

-- Advertencia: coincidencia con DEFAULT no equivale a registro historico
-- inmutable. Para auditoria de produccion hacen falta asientos de apertura,
-- registros de provisionamiento, permisos y pruebas de concurrencia reales.
