-- Contratos de privilegios para códigos DEMO en PostgreSQL desechable (NO Supabase).
-- Ninguna función de retiro falso debe permitir una llamada anon.
DO $$
DECLARE
 fn text;
BEGIN
 FOREACH fn IN ARRAY ARRAY[
   'public.mwd_owner_issue_pickup_code_demo(uuid,uuid)',
   'public.mwd_owner_mock_beneficiary_check_demo(uuid,uuid)',
   'public.mwd_owner_try_pickup_code_demo(uuid,text,uuid)',
   'public.mwd_owner_cancel_pickup_code_demo(uuid)',
   'public.mwd_owner_pickup_code_summary_demo(uuid)'
 ] LOOP
   IF has_function_privilege('anon',fn,'EXECUTE') THEN
     RAISE EXCEPTION 'API de códigos DEMO expuesta a anon: %',fn;
   END IF;
   IF NOT has_function_privilege('authenticated',fn,'EXECUTE') THEN
     RAISE EXCEPTION 'Función DEMO no disponible para autorización interna: %',fn;
   END IF;
 END LOOP;
END $$;

-- Un usuario autenticado que NO es dueño debe fallar por autorización
-- ANTES de consultar la orden. UUID inexistente no debe cambiar el resultado.
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
DO $$
DECLARE
 fake_order uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 request_id uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
BEGIN
 BEGIN
   PERFORM public.mwd_owner_issue_pickup_code_demo(fake_order,request_id);
   RAISE EXCEPTION 'No dueño logró emitir código DEMO';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 BEGIN
   PERFORM public.mwd_owner_mock_beneficiary_check_demo(fake_order,request_id);
   RAISE EXCEPTION 'No dueño logró marcar verificación ficticia';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 BEGIN
   PERFORM public.mwd_owner_try_pickup_code_demo(fake_order,'DEMO-00000000000000000000000000000000',request_id);
   RAISE EXCEPTION 'No dueño logró intentar un retiro ficticio';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 BEGIN
   PERFORM public.mwd_owner_cancel_pickup_code_demo(fake_order);
   RAISE EXCEPTION 'No dueño logró cancelar código DEMO';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 BEGIN
   PERFORM public.mwd_owner_pickup_code_summary_demo(fake_order);
   RAISE EXCEPTION 'No dueño logró consultar el código DEMO';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'Códigos DEMO: anon denegado y cinco RPC denegadas a no propietarios' AS result;
