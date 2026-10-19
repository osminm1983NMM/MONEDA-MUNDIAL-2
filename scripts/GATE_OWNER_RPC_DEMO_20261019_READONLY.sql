-- Moneda Mundial 2.0 | 2026-10-19 | SOLO DEMOSTRACION
-- Control de regresion de solo lectura. Ejecutar con SQL Editor (rol administrador).
-- NO prueba que un usuario no propietario sea rechazado en cada RPC,
-- NO mueve dinero, NO habilita proveedores y NO sustituye auditoria manual.
DO $mwd_audit$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_missing
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%'
    AND (
      NOT p.prosecdef
      OR has_function_privilege('anon',p.oid,'EXECUTE')
      OR NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig,array[]::text[])) AS conf(setting)
        WHERE conf.setting IN ('search_path=','search_path=""')
      )
      -- Solo es una comprobacion textual; revisar cada funcion de verdad.
      OR (position('assert_owner(' in pg_get_functiondef(p.oid))=0
        AND position('mwd_admin_roles' in pg_get_functiondef(p.oid))=0)
    );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Auditar seguridad de funciones owner: %',v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%'
  ) THEN
    RAISE EXCEPTION 'No se encontraron funciones owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Una funcion mwd esta disponible a anon';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_namespace n
    WHERE n.nspname LIKE 'mwd_%'
      AND (has_schema_privilege('anon',n.oid,'USAGE')
        OR has_schema_privilege('authenticated',n.oid,'USAGE'))
  ) THEN
    RAISE EXCEPTION 'Un esquema mwd privado permite USAGE al cliente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname LIKE 'mwd_%' AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Tabla MWD publica sin RLS';
  END IF;

  IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled)
    OR EXISTS (SELECT 1 FROM mwd_core.payment_corridors WHERE status <> 'disabled')
  THEN
    RAISE EXCEPTION 'Activacion de dinero real detectada; detener DEMO';
  END IF;

  IF (SELECT count(*) FROM mwd_finance_private.world_country_catalog) < 249
     OR NOT EXISTS (SELECT 1 FROM mwd_finance_private.world_country_catalog WHERE country_code='HN')
     OR NOT EXISTS (SELECT 1 FROM mwd_finance_private.world_country_catalog WHERE country_code='NI')
  THEN
    RAISE EXCEPTION 'Catalogo mundial incompleto: revisar paises';
  END IF;
END
$mwd_audit$;

SELECT 'PASS: chequeos estructurales SOLO DEMO; falta probar identidad no propietaria' AS resultado,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%') AS rpc_owner,
  (SELECT count(*) FROM mwd_finance_private.world_country_catalog) AS paises;
