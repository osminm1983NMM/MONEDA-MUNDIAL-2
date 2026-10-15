-- CONSULTAS DE SOLO LECTURA / Moneda Mundial 2.0.
-- Verifica permisos del esquema técnico antes y después del cambio propuesto.
-- No ejecuta ALTER ni modifica saldos.

WITH target(name) AS (
  VALUES ('currencies'),('countries'),('country_currencies'),('payment_corridors')
)
SELECT
  t.name AS table_name,
  c.oid IS NOT NULL AS exists_in_database,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS forced_rls,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon', c.oid,'SELECT') END AS anon_select,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated',c.oid,'SELECT') END AS auth_select,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated',c.oid,'UPDATE') END AS auth_update
FROM target t
LEFT JOIN pg_namespace n ON n.nspname = 'mwd_core'
LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname=t.name AND c.relkind='r'
ORDER BY t.name;

SELECT n.nspname,
       has_schema_privilege('anon',n.oid,'USAGE') AS anon_usage,
       has_schema_privilege('authenticated',n.oid,'USAGE') AS authenticated_usage
FROM pg_namespace n WHERE n.nspname='mwd_core';

SELECT schemaname,tablename,policyname,cmd,roles,qual,with_check
FROM pg_policies WHERE schemaname='mwd_core' ORDER BY tablename,policyname;

-- Constantes a contrastar con la comprobación previa; NO deducir licencias:
SELECT
  (SELECT count(*) FROM mwd_core.currencies) AS currencies,
  (SELECT count(*) FROM mwd_core.countries) AS countries,
  (SELECT count(*) FROM mwd_core.country_currencies) AS country_currencies,
  (SELECT count(*) FROM mwd_core.payment_corridors) AS payment_corridors,
  (SELECT count(*) FROM public.mwd_wallets) AS demo_wallets,
  (SELECT count(*) FROM public.mwd_operations) AS demo_operations,
  (SELECT count(*) FROM public.mwd_payment_requests) AS demo_payment_requests,
  (SELECT count(*) FROM mwd_finance_private.demo_fee_routes
   WHERE real_payments_enabled) AS real_enabled_routes;

-- Criterio de salida DESPUÉS de una migración aprobada:
-- 4 tablas con rls_enabled=true; anon/auth SELECT/UPDATE = false;
-- ninguna política cliente; cuentas y movimientos sin cambios;
-- backend y app demo probados con 2 cuentas Auth reales.
