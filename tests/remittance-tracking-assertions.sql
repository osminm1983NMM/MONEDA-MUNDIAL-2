-- Assertions de remesas ficticias; debe fallar ante privilegios incorrectos.
DO $$ BEGIN
 IF has_schema_privilege('authenticated','mwd_remittance_demo_private','USAGE')
 OR has_table_privilege('authenticated','mwd_remittance_demo_private.orders','SELECT')
 OR has_function_privilege('anon','public.mwd_owner_remittance_create_demo(text,bigint,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Exposición de datos privados'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='mwd_remittance_demo_private' AND c.relkind='r' AND c.relrowsecurity)<>2
 THEN RAISE EXCEPTION 'RLS de remesas incompleto'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$ BEGIN
 BEGIN
  PERFORM public.mwd_owner_remittances_demo();
  RAISE EXCEPTION 'Usuario normal pudo listar remesas';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE
 a jsonb;b jsonb;order_id uuid; cnt integer;
BEGIN
 a:=public.mwd_owner_remittance_create_demo('NI',10000,'11111111-1111-4111-8111-111111111111');
 order_id:=(a->>'id')::uuid;
 b:=public.mwd_owner_remittance_create_demo('NI',10000,'11111111-1111-4111-8111-111111111111');
 IF (a->>'id')<>(b->>'id') OR (b->>'already_processed')<>'true'
 THEN RAISE EXCEPTION 'Duplicó creación'; END IF;
 BEGIN
  PERFORM public.mwd_owner_remittance_create_demo('CR',10000,'11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Reuso peligroso';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.mwd_owner_remittance_transition_demo(order_id,'simulated','22222222-2222-4222-8222-222222222222');
  RAISE EXCEPTION 'Saltó revisión';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.mwd_owner_remittance_transition_demo(order_id,'review','33333333-3333-4333-8333-333333333333');
 a:=public.mwd_owner_remittance_transition_demo(order_id,'simulated','44444444-4444-4444-8444-444444444444');
 b:=public.mwd_owner_remittance_transition_demo(order_id,'simulated','44444444-4444-4444-8444-444444444444');
 IF (b->>'already_processed')<>'true' THEN RAISE EXCEPTION 'Reintento no idempotente'; END IF;
 IF (a->>'real_payments_enabled')<>'false' OR (a->>'redeemable')<>'false'
 THEN RAISE EXCEPTION 'Pago real habilitado'; END IF;
 BEGIN
  PERFORM public.mwd_owner_remittance_transition_demo(order_id,'cancelled','55555555-5555-4555-8555-555555555555');
  RAISE EXCEPTION 'Permitió modificar terminal';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT count(*) INTO cnt FROM public.mwd_owner_remittance_events_demo(order_id);
 IF cnt<>3 THEN RAISE EXCEPTION 'Historial duplicado: %',cnt; END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'Remesas DEMO: propietario, eventos, RLS e idempotencia correctos' AS result;
