-- Test del flujo de código NO COBRABLE, aislado de Supabase.
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN
   PERFORM public.mwd_owner_pickup_code_summary_demo('00000000-0000-4000-8000-000000000001');
   RAISE EXCEPTION 'Sin propietario: acceso indebido';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE o uuid;p uuid;l uuid;r jsonb; a jsonb;b jsonb;code text;
BEGIN
 r:=public.mwd_owner_remittance_create_demo('NI',10000,'20000000-0000-4000-8000-000000000001');
 o:=(r->>'id')::uuid;
 PERFORM public.mwd_owner_remittance_transition_demo(o,'review','20000000-0000-4000-8000-000000000002');
 r:=public.mwd_owner_partner_save_demo('Banco ejemplo sin dinero','bank','NI');p:=(r->>'id')::uuid;
 PERFORM public.mwd_owner_partner_set_status_demo(p,'under_review');
 PERFORM public.mwd_owner_partner_set_status_demo(p,'documented');
 r:=public.mwd_owner_partner_location_save_demo(p,'Sucursal ficticia','Managua','NIO');l:=(r->>'id')::uuid;
 PERFORM public.mwd_owner_assign_payout_design_demo(o,p,l,'20000000-0000-4000-8000-000000000003');
 PERFORM public.mwd_owner_remittance_transition_demo(o,'simulated','20000000-0000-4000-8000-000000000004');
 a:=public.mwd_owner_issue_pickup_code_demo(o,'20000000-0000-4000-8000-000000000005');
 code:=a->>'demo_code_once';
 IF code !~ '^DEMO-[0-9A-F]{32}$' OR a->>'redeemable'<>'false'
 THEN RAISE EXCEPTION 'Token de simulación inválido'; END IF;
 b:=public.mwd_owner_issue_pickup_code_demo(o,'20000000-0000-4000-8000-000000000005');
 IF b->>'already_processed'<>'true' OR b ? 'demo_code_once'
 THEN RAISE EXCEPTION 'Reintento volvió a revelar código'; END IF;
 a:=public.mwd_owner_try_pickup_code_demo(o,code,'20000000-0000-4000-8000-000000000006');
 IF a->>'status'<>'identity_demo_pending' THEN RAISE EXCEPTION 'Saltó simulación de identidad'; END IF;
 PERFORM public.mwd_owner_mock_beneficiary_check_demo(o,'20000000-0000-4000-8000-000000000007');
 a:=public.mwd_owner_try_pickup_code_demo(o,'DEMO-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF','20000000-0000-4000-8000-000000000008');
 IF a->>'remaining_attempts'<>'4' THEN RAISE EXCEPTION 'Intento incorrecto no contado'; END IF;
 a:=public.mwd_owner_try_pickup_code_demo(o,code,'20000000-0000-4000-8000-000000000009');
 IF a->>'status'<>'consumed' OR a->>'money_paid'<>'false' THEN RAISE EXCEPTION 'Consumo ficticio falló'; END IF;
 b:=public.mwd_owner_try_pickup_code_demo(o,code,'20000000-0000-4000-8000-000000000009');
 IF b->>'already_processed'<>'true' THEN RAISE EXCEPTION 'Reintento duplicó consumo'; END IF;
 b:=public.mwd_owner_try_pickup_code_demo(o,code,'20000000-0000-4000-8000-000000000010');
 IF b->>'accepted'<>'false' THEN RAISE EXCEPTION 'Un segundo cobro fue aceptado'; END IF;
 IF (SELECT count(*) FROM mwd_remittance_demo_private.pickup_code_samples)<>1
 THEN RAISE EXCEPTION 'Duplicó token'; END IF;
 IF (SELECT count(*) FROM mwd_remittance_demo_private.pickup_code_events WHERE action='consumed')<>1
 THEN RAISE EXCEPTION 'Duplicó consumo'; END IF;
END $$;
RESET ROLE; RESET request.jwt.claim.sub;
SELECT 'Prueba de código DEMO sin pago: OK' AS result;
