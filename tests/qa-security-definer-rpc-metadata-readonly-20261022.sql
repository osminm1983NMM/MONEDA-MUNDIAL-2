-- Moneda Mundial 2.0 | 2026-10-22 | SOLO QA DEMO
-- Auditoría estática de metadata RPC; es una prueba de regresión, NO pentest.
-- Los nombres de funciones, el texto de fuentes y las concesiones pueden ser
-- cambiados por otro despliegue: ejecutar esta prueba después de cambios SQL.
-- No consulta contraseñas, JWT, saldos ni datos identificadores de clientes.
-- No autoriza dinero real, criptomonedas ni proveedores; no cambia permisos.
-- Probar en Supabase de laboratorio con SQL Editor (administrador).
BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE
  v_definer_count int;
  v_owner_count int;
  v_dynamic_count int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'Una RPC MWD permite EXECUTE a anon'; END IF;

  SELECT count(*) INTO v_definer_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
    AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE');
  IF v_definer_count < 50 THEN
    RAISE EXCEPTION 'Inventario RPC insuficiente o no esperado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'mwd_%' AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) c(s)
      WHERE s IN ('search_path=','search_path=""')
    )
  ) THEN RAISE EXCEPTION 'RPC SECURITY DEFINER sin search_path fijado'; END IF;

  SELECT count(*) INTO v_owner_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%';
  IF v_owner_count < 37 THEN RAISE EXCEPTION 'Inventario owner incompleto'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%'
    AND NOT (
      position('assert_owner(' in pg_get_functiondef(p.oid))>0
      OR position('mwd_admin_roles' in pg_get_functiondef(p.oid))>0
    )
  ) THEN RAISE EXCEPTION 'RPC owner sin señal textual de autorización'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
      AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND p.proname NOT LIKE 'mwd_owner_%'
      AND position('auth.uid()' in pg_get_functiondef(p.oid))=0
  ) THEN RAISE EXCEPTION 'RPC privilegiada sin señal textual de identidad'; END IF;

  SELECT count(*) INTO v_dynamic_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
    AND p.prosecdef AND pg_get_functiondef(p.oid) ~* '[[:space:]]EXECUTE[[:space:]]';
  IF v_dynamic_count > 0 THEN
    RAISE NOTICE 'Revisión manual necesaria: % funciones con posible SQL dinámico',v_dynamic_count;
  END IF;

  RAISE NOTICE 'PASS STRUCTURAL GATE: % RPC privilegiadas, % owner, % posibles SQL dinamicos. No es pentest.',v_definer_count,v_owner_count,v_dynamic_count;
END $gate$;

SELECT 'PASS: Inventario de RPC privilegiadas MWD, gates estáticos de seguridad' AS result;
ROLLBACK;
