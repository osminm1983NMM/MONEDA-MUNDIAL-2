-- Moneda Mundial 2.0 | 2026-10-17
-- AUDITORÍA DE SEGURIDAD: SOLO LECTURA. No crea usuarios, cambia permisos,
-- transfiere fondos, activa corredores, revela datos personales ni llama RPCs.
--
-- Ejecutar con cuenta administradora en el SQL Editor de Supabase.
-- Este control no es una certificación, pentest ni sustituto de pruebas
-- negativas autenticadas con al menos dos cuentas diferentes.
--
-- Interpretación:
-- rpc_privileged_callable_with_login = superficie que NECESITA REVISIÓN
-- por función; NO significa que todas sean vulnerables.
-- Un valor cero en las métricas "sin protección" sólo confirma esta
-- configuración declarativa. No verifica todas las rutas de autorización.
WITH rpcs AS (
  SELECT p.oid,p.prosecdef,p.proconfig,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
),
priv_schemas AS (
  SELECT n.oid,n.nspname
  FROM pg_namespace n
  WHERE n.nspname LIKE 'mwd_%' AND n.nspname <> 'mwd_core'
),
public_tables AS (
  SELECT c.oid,c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND c.relname LIKE 'mwd_%'
)
SELECT
  (SELECT count(*) FROM rpcs) AS rpc_total,
  (SELECT count(*) FROM rpcs WHERE prosecdef AND auth_exec)
    AS rpc_privileged_callable_with_login,
  (SELECT count(*) FROM rpcs WHERE anon_exec)
    AS rpc_callable_without_login,
  (SELECT count(*) FROM rpcs WHERE prosecdef AND
    NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(proconfig,array[]::text[])) AS cfg
      WHERE cfg IN ('search_path=','search_path=""')
    )
  ) AS rpc_privileged_without_restricted_search_path,
  (SELECT count(*) FROM priv_schemas WHERE
    has_schema_privilege('anon',oid,'USAGE') OR
    has_schema_privilege('authenticated',oid,'USAGE')
  ) AS private_schemas_exposed_to_clients,
  (SELECT count(*) FROM public_tables WHERE NOT relrowsecurity)
    AS public_mwd_tables_without_rls,
  (SELECT count(*) FROM mwd_finance_private.demo_fee_routes
    WHERE real_payments_enabled) AS enabled_real_fee_routes,
  (SELECT count(*) FROM mwd_core.payment_corridors
    WHERE status <> 'disabled') AS enabled_core_corridors,
  (SELECT count(*) FROM mwd_finance_private.world_country_catalog)
    AS countries_in_catalog,
  (SELECT count(*) FROM mwd_finance_private.world_country_catalog
    WHERE country_code IN ('HN','NI')) AS honduras_and_nicaragua_count;
