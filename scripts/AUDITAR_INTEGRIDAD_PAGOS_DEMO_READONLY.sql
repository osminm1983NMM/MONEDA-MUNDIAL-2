-- MONEDA MUNDIAL 2.0: auditoría de integridad del prototipo.
-- SOLO LECTURA: no cambia operaciones, saldos, usuarios ni autorizaciones.
-- Revisar después de cada actualización backend. No prueba concurrencia E2E
-- ni autoriza la operación con dinero real.
--
-- Supuesto explícito y específico del DEMO ACTUAL:
-- cada billetera parte de 10000.00 MWD (=1000000 centavos ficticios).
WITH por_billetera AS (
  SELECT w.user_id,
    w.balance_cents AS observado,
    1000000::bigint
      + COALESCE((SELECT SUM(o.amount_cents) FROM public.mwd_operations o
                  WHERE o.kind='transfer' AND o.destination_user_id=w.user_id),0)
      - COALESCE((SELECT SUM(o.amount_cents) FROM public.mwd_operations o
                  WHERE o.source_user_id=w.user_id),0) AS esperado
  FROM public.mwd_wallets w
), auditoria AS (
  SELECT
    (SELECT COUNT(*) FROM por_billetera) AS billeteras_verificadas,
    (SELECT COUNT(*) FROM por_billetera WHERE observado<>esperado) AS saldos_inconsistentes,
    (SELECT COUNT(*) FROM (
        SELECT actor_id,request_id FROM public.mwd_operations
        GROUP BY actor_id,request_id HAVING COUNT(*)>1
     ) d) AS solicitudes_duplicadas,
    (SELECT COUNT(*) FROM public.mwd_payment_requests p
       WHERE p.status='paid' AND NOT EXISTS(
         SELECT 1 FROM public.mwd_operations o
         WHERE o.request_id=p.id AND o.kind='transfer'
           AND o.destination_user_id=p.merchant_user_id
           AND o.amount_cents=p.amount_cents
       )) AS cobros_pagados_sin_transferencia,
    (SELECT COUNT(*) FROM public.mwd_payment_requests p
       WHERE p.status='cancelled' AND EXISTS(
         SELECT 1 FROM public.mwd_operations o WHERE o.request_id=p.id
           AND o.kind='transfer'
       )) AS cobros_cancelados_con_transferencia,
    (SELECT COUNT(*) FROM public.mwd_wallets
       WHERE balance_cents<0 OR balance_cents>100000000000) AS saldos_fuera_de_rango,
    (SELECT COALESCE(SUM(observado),0) FROM por_billetera) AS saldo_total_centavos,
    (SELECT COALESCE(SUM(amount_cents),0) FROM public.mwd_operations
       WHERE kind='contribution') AS aportaciones_centavos
)
SELECT *, CASE
 WHEN saldos_inconsistentes=0 AND solicitudes_duplicadas=0
   AND cobros_pagados_sin_transferencia=0
   AND cobros_cancelados_con_transferencia=0 AND saldos_fuera_de_rango=0
 THEN 'INTEGRIDAD DEMO: SIN ANOMALÍAS DETECTADAS'
 ELSE 'REVISAR: HAY ANOMALÍAS EN LA DEMOSTRACIÓN' END AS resultado
FROM auditoria;

-- Comprobar presencia de restricción UNIQUE para idempotencia de la RPC.
SELECT c.conname AS restriccion,pg_get_constraintdef(c.oid) AS definicion
FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname='public' AND t.relname='mwd_operations'
  AND c.conname='mwd_unique_request';

-- RLS de datos personales y operaciones: se esperan 5 tablas protegidas.
SELECT t.tablename,t.rowsecurity AS rls_activo
FROM pg_tables t WHERE t.schemaname='public'
  AND t.tablename IN ('mwd_wallets','mwd_operations','mwd_payment_requests',
                      'mwd_merchants','mwd_admin_roles')
ORDER BY t.tablename;

-- Comprobar que ninguna RPC financiera permita ejecución sin autenticación.
SELECT p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') AS ejecutable_sin_iniciar_sesion,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS ejecutable_con_sesion
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'mwd_transfer_demo','mwd_contribute_demo','mwd_pay_merchant_demo',
 'mwd_cancel_payment_request_demo','mwd_owner_summary_demo',
 'mwd_owner_update_demo_fee')
ORDER BY p.proname;

-- NO sustituye pruebas con dos usuarios autenticados,
-- condiciones de carrera, ni revisión legal de sistema financiero real.
