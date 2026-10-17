-- MONEDA MUNDIAL 2.0 | auditoria de SOLO LECTURA
-- No crea, cambia, borra, mueve dinero, ni activa un corredor.
-- Ejecutar luego de una migracion DEMO expresamente autorizada; NO es un despliegue.
WITH functions AS (
 SELECT
   to_regprocedure('public.mwd_demo_payout_closure_capability()') AS capability_oid,
   to_regprocedure('public.mwd_owner_complete_payout_sample_demo(uuid,uuid)') AS closure_oid
),
code AS (
 SELECT functions.*,
   coalesce(lower(pg_get_functiondef(closure_oid)), '') AS closure_sql
 FROM functions
),
checks AS (
 SELECT
   capability_oid IS NOT NULL AS capability_exists,
   coalesce((SELECT NOT p.prosecdef FROM pg_proc p WHERE p.oid=capability_oid),false)
     AS capability_is_security_invoker,
   NOT coalesce(has_function_privilege('anon',capability_oid,'EXECUTE'),false)
     AS capability_denies_anon,
   coalesce(has_function_privilege('authenticated',capability_oid,'EXECUTE'),false)
     AS capability_allows_signed_in,
   closure_oid IS NOT NULL AS closure_exists,
   position('pickup_code_samples' in closure_sql)>0
      AND position('v_sample.status<>''consumed''' in closure_sql)>0
      AND position('v_sample.consume_request_id is null' in closure_sql)>0
      AND position('v_sample.identity_check_simulated_at is null' in closure_sql)>0
      AND position('pickup_code_events' in closure_sql)>0
      AS closure_source_checks_consumed_sample,
   NOT coalesce(has_function_privilege('anon',closure_oid,'EXECUTE'),false)
      AS closure_denies_anon,
   coalesce(has_function_privilege('authenticated',closure_oid,'EXECUTE'),false)
      AS closure_allows_signed_in,
   (SELECT count(*) FROM mwd_finance_private.demo_fee_routes
      WHERE real_payments_enabled)=0 AS no_real_fee_routes,
   (SELECT count(*) FROM mwd_core.payment_corridors
      WHERE status<>'disabled')=0 AS no_open_financial_corridors,
   (SELECT count(DISTINCT country_code) FROM mwd_finance_private.world_country_catalog
      WHERE country_code IN ('HN','NI'))=2 AS honduras_nicaragua_in_catalog
 FROM code
)
SELECT
 CASE WHEN capability_exists AND capability_is_security_invoker
    AND capability_denies_anon AND capability_allows_signed_in
    AND closure_exists AND closure_source_checks_consumed_sample
    AND closure_denies_anon AND closure_allows_signed_in
    AND no_real_fee_routes AND no_open_financial_corridors
    AND honduras_nicaragua_in_catalog
   THEN 'PASO_CONTROL_DEMO_PRELIMINAR' ELSE 'BLOQUEADO_POR_CONTROLES_PENDIENTES'
 END AS estado_verificacion,
 -- Ningun informe automatico sustituye pruebas negativas con dos cuentas.
 false AS autorizacion_para_dinero_real,
 capability_exists,capability_is_security_invoker,
 capability_denies_anon,capability_allows_signed_in,
 closure_exists,closure_source_checks_consumed_sample,
 closure_denies_anon,closure_allows_signed_in,
 no_real_fee_routes,no_open_financial_corridors,
 honduras_nicaragua_in_catalog
FROM checks;