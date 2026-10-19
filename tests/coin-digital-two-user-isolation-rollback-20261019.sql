-- MONEDA MUNDIAL 2.0 | 19 OCT 2026 | SOLO LABORATORIO
-- Prueba SQL ejecutable de conversiones COIN <-> STABLE con dos cuentas.
-- Ejecutar en SQL Editor admin del Supabase DEMO, nunca en produccion.
-- Usa dos usuarios de prueba existentes SIN rol owner, sin exponer sus identidades.
-- Simula rol/JWT en SQL; NO verifica tokens JWT firmados en API/Android.
-- Toda escritura transaccional se revierte con ROLLBACK; nunca activa dinero real.
BEGIN;
DO $setup$
DECLARE a uuid; b uuid;
BEGIN
  SELECT u.id INTO a FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.mwd_admin_roles ar
                      WHERE ar.user_id=u.id AND ar.role='owner')
    ORDER BY u.created_at DESC LIMIT 1;
  SELECT u.id INTO b FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.mwd_admin_roles ar
                      WHERE ar.user_id=u.id AND ar.role='owner')
    ORDER BY u.created_at DESC OFFSET 1 LIMIT 1;
  IF a IS NULL OR b IS NULL OR a=b THEN
    RAISE EXCEPTION 'Se requieren dos cuentas NO propietarias de prueba';
  END IF;
  IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_fee_routes
             WHERE real_payments_enabled)
    OR EXISTS (SELECT 1 FROM mwd_core.payment_corridors
               WHERE status <> 'disabled')
    OR NOT EXISTS (SELECT 1 FROM mwd_swap_private.demo_rates
                   WHERE id='sandbox_v1' AND active AND stable_per_coin>0)
  THEN
    RAISE EXCEPTION 'Laboratorio no aislado: NO ejecutar prueba';
  END IF;
  PERFORM pg_catalog.set_config('mwd.test.a',a::text,true);
  PERFORM pg_catalog.set_config('mwd.test.b',b::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
 a uuid:=current_setting('mwd.test.a')::uuid;
 b uuid:=current_setting('mwd.test.b')::uuid;
 wa0 jsonb; wa1 jsonb; wa2 jsonb;
 wb0 jsonb; wb1 jsonb; wb2 jsonb;
 qa jsonb; qa_repeat jsonb; ra jsonb; ra_again jsonb; sta jsonb;
 qb jsonb; rb jsonb; stb jsonb;
 ca uuid; cb uuid;
 request_a uuid:=pg_catalog.gen_random_uuid();
 denials integer:=0;
BEGIN
 IF current_user <> 'authenticated' THEN
   RAISE EXCEPTION 'No se establecio rol authenticated';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',
   jsonb_build_object('sub',a::text,'role','authenticated')::text,true);
 IF auth.uid() IS DISTINCT FROM a THEN RAISE EXCEPTION 'Identidad A no valida'; END IF;
 wa0:=public.mwd_conversion_wallet_demo();
 IF wa0->>'mode'<>'sandbox_only'
   OR wa0->>'realPaymentsEnabled'<>'false' THEN
   RAISE EXCEPTION 'Billetera A no es DEMO';
 END IF;
 qa:=public.mwd_conversion_quote_demo('COIN',1000000,request_a);
 qa_repeat:=public.mwd_conversion_quote_demo('COIN',1000000,request_a);
 IF qa->>'quoteId' IS DISTINCT FROM qa_repeat->>'quoteId'
   OR qa->>'realPaymentsEnabled'<>'false'
   OR qa->>'provider'<>'synthetic_sandbox'
   OR qa->>'status'<>'quoted' THEN
   RAISE EXCEPTION 'Cotizacion A no idempotente / no DEMO';
 END IF;
 BEGIN
   PERFORM public.mwd_conversion_quote_demo('COIN',1000001,request_a);
   RAISE EXCEPTION 'Reuso de UUID acepto diferente monto';
 EXCEPTION WHEN sqlstate '22023' THEN denials:=denials+1;
 END;
 ca:=(qa->>'quoteId')::uuid;
 ra:=public.mwd_conversion_confirm_demo(ca);
 ra_again:=public.mwd_conversion_confirm_demo(ca);
 sta:=public.mwd_conversion_reconcile_demo(ca);
 IF ra->>'status'<>'ok' OR ra_again->>'status'<>'already_processed'
   OR ra->>'conversionId' IS DISTINCT FROM ra_again->>'conversionId'
   OR sta->>'status'<>'executed'
   OR sta->>'conversionId' IS DISTINCT FROM ra->>'conversionId'
   OR ra->>'realPaymentsEnabled'<>'false' THEN
   RAISE EXCEPTION 'Conversion A no fue idempotente y conciliada';
 END IF;
 wa1:=public.mwd_conversion_wallet_demo();
 IF (wa1->>'coinMicro')::bigint<>(wa0->>'coinMicro')::bigint-1000000
   OR (wa1->>'stableMicro')::bigint<>
      (wa0->>'stableMicro')::bigint+(ra->>'amountOutMicro')::bigint THEN
   RAISE EXCEPTION 'Asientos A incorrectos';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 PERFORM set_config('request.jwt.claims',
   jsonb_build_object('sub',b::text,'role','authenticated')::text,true);
 IF auth.uid() IS DISTINCT FROM b THEN RAISE EXCEPTION 'Identidad B no valida'; END IF;
 wb0:=public.mwd_conversion_wallet_demo();
 IF wb0->>'mode'<>'sandbox_only' OR wb0->>'realPaymentsEnabled'<>'false' THEN
   RAISE EXCEPTION 'Billetera B no es DEMO';
 END IF;
 BEGIN
   PERFORM public.mwd_conversion_reconcile_demo(ca);
   RAISE EXCEPTION 'Usuario B leyo referencia A';
 EXCEPTION WHEN sqlstate '22023' THEN denials:=denials+1;
 END;
 BEGIN
   PERFORM public.mwd_conversion_confirm_demo(ca);
   RAISE EXCEPTION 'Usuario B confirmo referencia A';
 EXCEPTION WHEN sqlstate '22023' THEN denials:=denials+1;
 END;
 wb1:=public.mwd_conversion_wallet_demo();
 IF wb0 IS DISTINCT FROM wb1 THEN
   RAISE EXCEPTION 'Denegaciones alteraron billetera B';
 END IF;
 qb:=public.mwd_conversion_quote_demo('STABLE',1000000,pg_catalog.gen_random_uuid());
 IF qb->>'realPaymentsEnabled'<>'false'
   OR qb->>'provider'<>'synthetic_sandbox' THEN
   RAISE EXCEPTION 'Cotizacion B no es DEMO';
 END IF;
 cb:=(qb->>'quoteId')::uuid;
 rb:=public.mwd_conversion_confirm_demo(cb);
 stb:=public.mwd_conversion_reconcile_demo(cb);
 IF rb->>'status'<>'ok' OR stb->>'status'<>'executed'
   OR stb->>'conversionId' IS DISTINCT FROM rb->>'conversionId' THEN
   RAISE EXCEPTION 'STABLE a COIN B no conciliada';
 END IF;
 wb2:=public.mwd_conversion_wallet_demo();
 IF (wb2->>'stableMicro')::bigint<>(wb1->>'stableMicro')::bigint-1000000
   OR (wb2->>'coinMicro')::bigint<>
      (wb1->>'coinMicro')::bigint+(rb->>'amountOutMicro')::bigint THEN
   RAISE EXCEPTION 'Asientos B incorrectos';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',
   jsonb_build_object('sub',a::text,'role','authenticated')::text,true);
 wa2:=public.mwd_conversion_wallet_demo();
 IF wa1 IS DISTINCT FROM wa2 THEN
   RAISE EXCEPTION 'Conversion B modifico billetera A';
 END IF;
 BEGIN
   PERFORM public.mwd_conversion_reconcile_demo(cb);
   RAISE EXCEPTION 'Usuario A leyo referencia B';
 EXCEPTION WHEN sqlstate '22023' THEN denials:=denials+1;
 END;
 IF denials<>4 THEN
   RAISE EXCEPTION 'Esperados 4 rechazos; obtenidos %',denials;
 END IF;
 RAISE NOTICE 'PASS: 2 usuarios, ambas conversiones, reintento, recibos, 4 rechazos';
END $test$;
ROLLBACK;
-- Si se completo el lote sin error, las operaciones quedaron revertidas.
SELECT 'PASS: pruebas Coin/Digital DEMO completas y revertidas' AS resultado;
