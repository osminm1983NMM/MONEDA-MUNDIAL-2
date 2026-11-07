-- Moneda Mundial 2.0: auditoría de importación contable (SOLO LECTURA).
-- MWD es crédito ficticio; NO representa USD ni fondos custodiados.
-- Asume crédito inicial de 1,000,000 centésimos MWD por billetera.
-- NO crea cuentas, transacciones, asientos ni modifica saldos.
WITH movimientos AS (
 SELECT 'MWD-OPEN-'||w.user_id::text AS referencia,
        'SUSPENSE-DEMO-MWD'::text AS cuenta, 'debit'::text AS lado,
        1000000::bigint AS importe
 FROM public.mwd_wallets w
 UNION ALL
 SELECT 'MWD-OPEN-'||w.user_id::text,
        'CUSTOMER-'||w.user_id::text,'credit',1000000::bigint
 FROM public.mwd_wallets w
 UNION ALL
 SELECT 'MWD-OP-'||o.id::text,
        'CUSTOMER-'||o.source_user_id::text,'debit',o.amount_cents
 FROM public.mwd_operations o
 UNION ALL
 SELECT 'MWD-OP-'||o.id::text,
        CASE WHEN o.kind='transfer'
             THEN 'CUSTOMER-'||o.destination_user_id::text
             ELSE 'SUSPENSE-DEMO-MWD' END,
        'credit',o.amount_cents
 FROM public.mwd_operations o
),
por_transaccion AS (
 SELECT referencia, count(*) AS asientos,
        coalesce(sum(importe) FILTER (WHERE lado='debit'),0) AS debitos,
        coalesce(sum(importe) FILTER (WHERE lado='credit'),0) AS creditos
 FROM movimientos GROUP BY referencia
),
por_cuenta AS (
 SELECT cuenta, sum(CASE WHEN lado='credit' THEN importe ELSE -importe END) AS saldo
 FROM movimientos GROUP BY cuenta
)
SELECT
 (SELECT count(*) FROM por_transaccion) AS transacciones_simuladas,
 (SELECT count(*) FROM movimientos) AS asientos_simulados,
 (SELECT count(*) FROM por_transaccion WHERE asientos<>2 OR debitos<>creditos)
   AS transacciones_descuadradas,
 (SELECT count(*) FROM public.mwd_wallets w
  LEFT JOIN por_cuenta c ON c.cuenta='CUSTOMER-'||w.user_id::text
  WHERE w.balance_cents IS DISTINCT FROM c.saldo) AS billeteras_con_diferencias,
 (SELECT count(*) FROM por_transaccion p
  JOIN mwd_finance_private.ledger_transactions t
  ON t.external_reference=p.referencia) AS referencias_ya_importadas,
 (SELECT count(*) FROM mwd_finance_private.ledger_transactions) AS transacciones_actuales_libro_mayor;
-- IMPORTANTE: La cuenta suspense es una contrapartida de simulación,
-- no ingreso de la empresa ni dinero real.
