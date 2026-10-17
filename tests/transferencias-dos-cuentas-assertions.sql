-- Pruebas de integración SOLO con A y B ficticios en PostgreSQL aislado.
-- Requiere tests/transferencias-dos-cuentas-fixture.sql. NO toca Supabase.
-- Todas las cantidades son créditos MWD ficticios expresados en centavos.

-- 1: no hay operaciones ni saldos alterados antes del ensayo.
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.mwd_wallets)<>2
     OR (SELECT sum(balance_cents) FROM public.mwd_wallets)<>2000000
     OR (SELECT count(*) FROM public.mwd_operations)<>0
  THEN RAISE EXCEPTION 'Datos iniciales inesperados'; END IF;
END $test$;

-- 2: cliente anónimo sin permisos para observar saldos ni ejecutar RPC.
SET ROLE anon;
SET request.jwt.claim.sub = '';
DO $test$
DECLARE v_denied boolean:=false;
BEGIN
  IF has_table_privilege(current_user,'public.mwd_wallets','SELECT')
     OR has_function_privilege(current_user,
       'public.mwd_transfer_demo(text,bigint,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Permisos anónimos indebidos';
  END IF;
  BEGIN
    PERFORM public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',100,
      '20000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Anónimo ejecutó una transferencia'; END IF;
END $test$;
RESET ROLE;

-- 3: A solo ve la billetera y el rol administrativo propios.
SET ROLE authenticated;
SET request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $test$
DECLARE
  v_count bigint;
  v_result jsonb;
  v_denied boolean;
BEGIN
  SELECT count(*) INTO v_count FROM public.mwd_wallets;
  IF v_count<>1 OR NOT EXISTS(
      SELECT 1 FROM public.mwd_wallets
      WHERE account_code='MWD-AAAAAAAAAAAAAAAA') THEN
    RAISE EXCEPTION 'A accedió a billeteras ajenas';
  END IF;

  SELECT count(*) INTO v_count FROM public.mwd_admin_roles;
  IF v_count<>1 THEN RAISE EXCEPTION 'A no ve su rol propietario'; END IF;

  -- A envía 1.00 MWD ficticios a B.
  v_result:=public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',100,
    '20000000-0000-4000-8000-000000000001'::uuid);
  IF v_result->>'status'<>'ok' OR (v_result->>'balance_cents')::bigint<>999900
  THEN RAISE EXCEPTION 'Primera transferencia fallida: %',v_result; END IF;

  -- Repetición exacta: no debe descontar por segunda vez.
  v_result:=public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',100,
    '20000000-0000-4000-8000-000000000001'::uuid);
  IF v_result->>'status'<>'already_processed' OR
     (v_result->>'balance_cents')::bigint<>999900
  THEN RAISE EXCEPTION 'Idempotencia incorrecta: %',v_result; END IF;

  -- Reutilizar UUID con parámetros modificados debe rechazarse.
  v_denied:=false;
  BEGIN
    PERFORM public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',101,
      '20000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'UUID reutilizado con otro importe'; END IF;

  -- Prohibir enviarse dinero a la propia cuenta.
  v_denied:=false;
  BEGIN
    PERFORM public.mwd_transfer_demo('MWD-AAAAAAAAAAAAAAAA',1,
      '20000000-0000-4000-8000-000000000002'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Autotransferencia permitida'; END IF;

  -- No permitir saldo ficticio negativo.
  v_denied:=false;
  BEGIN
    PERFORM public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',1000000,
      '20000000-0000-4000-8000-000000000003'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Saldo insuficiente no rechazado'; END IF;
END $test$;
RESET ROLE;

-- 4: B recibe 1.00 MWD y solo puede leer sus datos propios.
SET ROLE authenticated;
SET request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $test$
DECLARE v_result jsonb; v_denied boolean:=false;
BEGIN
  IF (SELECT count(*) FROM public.mwd_wallets)<>1
     OR (SELECT balance_cents FROM public.mwd_wallets)<>1000100
     OR (SELECT count(*) FROM public.mwd_merchants)<>0
     OR (SELECT count(*) FROM public.mwd_admin_roles)<>0
  THEN RAISE EXCEPTION 'B puede ver datos privados de A o saldo incorrecto'; END IF;
  -- Historial: B sí ve las transferencias donde fue receptor.
  IF (SELECT count(*) FROM public.mwd_operations)<>1 THEN
    RAISE EXCEPTION 'B no visualiza su transferencia entrante'; END IF;

  -- Los permisos RPC se restringen internamente al rol propietario.
  BEGIN PERFORM public.mwd_owner_summary_demo();
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'B pudo acceder al resumen del propietario'; END IF;

  -- El cobro pendiente es consultable para pagar, pero no como tabla privada.
  IF (SELECT count(*) FROM public.mwd_payment_requests)<>0 THEN
    RAISE EXCEPTION 'B puede leer solicitudes privadas de A'; END IF;
  v_result:=public.mwd_get_payment_request_demo(
    '10000000-0000-4000-8000-000000000001'::uuid);
  IF v_result->>'status'<>'pending' OR
     (v_result->>'amount_cents')::bigint<>200 THEN
    RAISE EXCEPTION 'B no puede verificar el cobro público pendiente'; END IF;

  -- B paga a A 2.00 MWD ficticios exactamente una vez.
  v_result:=public.mwd_pay_merchant_demo(
    '10000000-0000-4000-8000-000000000001'::uuid);
  IF v_result->>'status'<>'ok' THEN
    RAISE EXCEPTION 'Pago de B a A no confirmado: %',v_result; END IF;
  v_result:=public.mwd_pay_merchant_demo(
    '10000000-0000-4000-8000-000000000001'::uuid);
  IF v_result->>'status'<>'already_processed' THEN
    RAISE EXCEPTION 'Reintento de pago no fue idempotente: %',v_result; END IF;

  -- B NO puede cancelar solicitudes de A.
  v_denied:=false;
  BEGIN PERFORM public.mwd_cancel_payment_request_demo(
      '10000000-0000-4000-8000-000000000002'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'B canceló un cobro de A'; END IF;
END $test$;
RESET ROLE;

-- 5: A no puede cancelar el cobro ya pagado, pero sí cancelar el pendiente.
SET ROLE authenticated;
SET request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $test$
DECLARE v_result jsonb; v_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.mwd_cancel_payment_request_demo(
      '10000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'A canceló un cobro ya pagado'; END IF;
  v_result:=public.mwd_cancel_payment_request_demo(
    '10000000-0000-4000-8000-000000000002'::uuid);
  IF v_result->>'status'<>'cancelled' THEN
    RAISE EXCEPTION 'A no pudo cancelar el cobro pendiente: %',v_result; END IF;

  -- A hace una aportación de prueba de 0.50 MWD; reintentar no duplica.
  v_result:=public.mwd_contribute_demo(50,
    '20000000-0000-4000-8000-000000000004'::uuid);
  IF v_result->>'status'<>'ok' THEN RAISE EXCEPTION 'Aportación fallida'; END IF;
  v_result:=public.mwd_contribute_demo(50,
    '20000000-0000-4000-8000-000000000004'::uuid);
  IF v_result->>'status'<>'already_processed' THEN
    RAISE EXCEPTION 'Aportación duplicada: %',v_result; END IF;
END $test$;
RESET ROLE;

-- 6: B no debe pagar cobros cancelados de A.
SET ROLE authenticated;
SET request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $test$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.mwd_pay_merchant_demo(
      '10000000-0000-4000-8000-000000000002'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'B pagó un cobro cancelado'; END IF;
END $test$;
RESET ROLE;

-- 6b: un UUID de transferencia/pago no puede reutilizarse como aportación.
-- Esto comprueba que un reintento con tipo alterado no genere otro débito.
SET ROLE authenticated;
SET request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $test$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.mwd_contribute_demo(25,
      '20000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied := true; END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'A reutilizo UUID de transferencia como aportacion';
  END IF;
END $test$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $test$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.mwd_contribute_demo(25,
      '10000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN OTHERS THEN v_denied := true; END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'B reutilizo UUID de pago como aportacion';
  END IF;
END $test$;
RESET ROLE;

-- 7: comprobación de integridad como administrador del servidor DESECHABLE.
DO $test$
DECLARE
  a_balance bigint;
  b_balance bigint;
  transfers bigint;
  contributions bigint;
BEGIN
  SELECT balance_cents INTO a_balance FROM public.mwd_wallets
    WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  SELECT balance_cents INTO b_balance FROM public.mwd_wallets
    WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  SELECT count(*) INTO transfers FROM public.mwd_operations WHERE kind='transfer';
  SELECT count(*) INTO contributions FROM public.mwd_operations WHERE kind='contribution';
  -- A: 1000000 -100 +200 -50 = 1000050.
  -- B: 1000000 +100 -200 = 999900.
  IF a_balance<>1000050 OR b_balance<>999900
     OR transfers<>2 OR contributions<>1
     OR (SELECT sum(balance_cents) FROM public.mwd_wallets)<>1999950
     OR (SELECT status FROM public.mwd_payment_requests
           WHERE id='10000000-0000-4000-8000-000000000001')<>'paid'
     OR (SELECT status FROM public.mwd_payment_requests
           WHERE id='10000000-0000-4000-8000-000000000002')<>'cancelled'
  THEN
    RAISE EXCEPTION 'Integridad de dos cuentas fallida: A=%, B=%, T=%, C=%',
      a_balance,b_balance,transfers,contributions;
  END IF;
  RAISE NOTICE 'PRUEBAS APROBADAS: 2 cuentas; transferencias, idempotencia, pagos, cancelaciones, autorizaciones y RLS. A=%, B=%',
    a_balance,b_balance;
END $test$;
