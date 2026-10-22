-- Moneda Mundial 2.0 | QA RLS de dos cuentas ya existentes (SOLO DEMO)
-- Fecha: 2026-10-22
-- PRUEBA EXCLUSIVAMENTE DE LECTURA sobre la BD de laboratorio.
-- No crea usuarios, no modifica saldos, no lee contraseñas, tokens ni correos.
-- Se ejecuta bajo rol 'authenticated' con claims simulados mediante set_config.
-- IMPORTANTE: NO valida firmas JWT auténticas por HTTP ni reemplaza un pentest.
-- Requisito: al menos dos billeteras existentes con perfil en public.
-- Ejecutar como administrador en Supabase SQL Editor o con psql -v ON_ERROR_STOP=1.
-- ROLLBACK garantiza que ni los GUC ni cualquier trabajo transaccional persistan.
BEGIN TRANSACTION READ ONLY;

DO $setup$
DECLARE v_a uuid; v_b uuid;
BEGIN
  -- Identificadores privados solamente dentro de esta transacción, sin imprimir.
  SELECT user_id INTO v_a FROM public.mwd_wallets ORDER BY user_id LIMIT 1;
  SELECT user_id INTO v_b FROM public.mwd_wallets
    WHERE user_id <> v_a ORDER BY user_id LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'Prueba no concluyente: faltan dos billeteras existentes';
  END IF;
  PERFORM set_config('mwd.qa.actor_a',v_a::text,true);
  PERFORM set_config('mwd.qa.actor_b',v_b::text,true);
END $setup$;

SET LOCAL ROLE authenticated;

DO $rls_probe$
DECLARE v_actor uuid; v_label text;
BEGIN
  -- La prueba se repite con dos identidades distintas (cambios de sesión).
  FOREACH v_label IN ARRAY ARRAY['a','b'] LOOP
    v_actor:=current_setting('mwd.qa.actor_' || v_label,true)::uuid;
    PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);

    IF auth.uid() IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'La identidad simulada no se activó: %',v_label;
    END IF;

    -- Cobertura no vacía: exactamente una billetera y un perfil por cuenta.
    IF (SELECT count(*) FROM public.mwd_wallets) <> 1 OR
       EXISTS (SELECT 1 FROM public.mwd_wallets WHERE user_id <> v_actor) THEN
      RAISE EXCEPTION 'Acceso indebido a billeteras: %',v_label;
    END IF;
    IF (SELECT count(*) FROM public.mwd_profiles) <> 1 OR
       EXISTS (SELECT 1 FROM public.mwd_profiles WHERE user_id <> v_actor) THEN
      RAISE EXCEPTION 'Acceso indebido a perfiles: %',v_label;
    END IF;

    -- RLS impide consultar roles ajenos y datos de otras cuentas o comercios.
    IF EXISTS (SELECT 1 FROM public.mwd_admin_roles WHERE user_id <> v_actor)
       OR EXISTS (SELECT 1 FROM public.mwd_operations
                  WHERE source_user_id <> v_actor AND destination_user_id <> v_actor)
       OR EXISTS (SELECT 1 FROM public.mwd_merchants WHERE owner_user_id <> v_actor)
       OR EXISTS (SELECT 1 FROM public.mwd_payment_requests WHERE merchant_user_id <> v_actor) THEN
      RAISE EXCEPTION 'Filtración de información cruzada: %',v_label;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS: lectura RLS en seis tablas para dos identidades simuladas';
END $rls_probe$;

SELECT 'PASS: RLS dos cuentas simuladas, seis tablas públicas, READ ONLY' AS result;
ROLLBACK;
