-- Moneda Mundial 2.0 | Prueba negativa de autorización (SOLO DEMO)
-- Ejecutar con administrador SQL en la BASE DE PRUEBAS, nunca en producción.
-- Este test usa una cuenta existente que NO sea owner, sin leer email, contraseña ni PII.
-- No crea usuarios, no cobra, no altera billeteras, no activa dinero real.
-- Usa SET LOCAL y ROLLBACK, siguiendo la guía de pruebas RLS de Supabase.
--
-- LIMITACIÓN: simula rol/JWT dentro de PostgreSQL. NO reemplaza sesiones reales
-- por la API, ni demuestra la seguridad de las 37 RPC owner con parámetros.
-- Solo prueba las 9 funciones de lectura sin argumentos enumeradas abajo.

BEGIN;

-- Capturar un ID de cuenta autenticada que NO sea propietaria sin mostrarlo.
DO $actor$
DECLARE v_user_id uuid;
BEGIN
  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mwd_admin_roles r
    WHERE r.user_id=u.id AND r.role='owner'
  )
  ORDER BY u.created_at DESC LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No existe una cuenta de prueba no propietaria';
  END IF;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
END $actor$;

SET LOCAL ROLE authenticated;

DO $non_owner_checks$
DECLARE v_fn text; v_denied integer := 0;
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No se simulo una identidad autenticada';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'mwd_owner_agent_audit_demo',
    'mwd_owner_agent_list_demo',
    'mwd_owner_conversion_dashboard_demo',
    'mwd_owner_demo_fee_catalog',
    'mwd_owner_partners_demo',
    'mwd_owner_pickup_orders_demo',
    'mwd_owner_pickup_security_demo',
    'mwd_owner_remittances_demo',
    'mwd_owner_summary_demo'
  ] LOOP
    BEGIN
      EXECUTE format('SELECT 1 FROM public.%I() LIMIT 1', v_fn);
      RAISE EXCEPTION 'FALLO: RPC owner expuesta a usuario no propietario: %', v_fn;
    EXCEPTION WHEN insufficient_privilege THEN
      v_denied := v_denied + 1;
    END;
  END LOOP;

  IF v_denied <> 9 THEN
    RAISE EXCEPTION 'FALLO: esperadas 9 denegaciones, recibidas %', v_denied;
  END IF;

  RAISE NOTICE 'PASS: 9 RPC de lectura owner rechazaron a usuario autenticado no propietario';
END $non_owner_checks$;

ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;

DO $anon_checks$
DECLARE v_fn text; v_denied integer := 0;
BEGIN
  IF current_user <> 'anon' THEN
    RAISE EXCEPTION 'No se simulo la sesion anonima';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'mwd_owner_agent_audit_demo',
    'mwd_owner_agent_list_demo',
    'mwd_owner_conversion_dashboard_demo',
    'mwd_owner_demo_fee_catalog',
    'mwd_owner_partners_demo',
    'mwd_owner_pickup_orders_demo',
    'mwd_owner_pickup_security_demo',
    'mwd_owner_remittances_demo',
    'mwd_owner_summary_demo'
  ] LOOP
    BEGIN
      EXECUTE format('SELECT 1 FROM public.%I() LIMIT 1', v_fn);
      RAISE EXCEPTION 'FALLO: RPC owner expuesta a anon: %', v_fn;
    EXCEPTION WHEN insufficient_privilege THEN
      v_denied := v_denied + 1;
    END;
  END LOOP;

  IF v_denied <> 9 THEN
    RAISE EXCEPTION 'FALLO: esperadas 9 denegaciones anon, recibidas %', v_denied;
  END IF;

  RAISE NOTICE 'PASS: 9 RPC de lectura owner rechazaron al rol anon';
END $anon_checks$;

ROLLBACK;
