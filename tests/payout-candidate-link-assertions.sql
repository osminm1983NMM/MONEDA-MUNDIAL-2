-- Entorno PostgreSQL CI ficticio; no toca Supabase ni dinero real.
DO $$ BEGIN
 IF has_schema_privilege('authenticated','mwd_remittance_demo_private','USAGE')
    OR has_table_privilege('authenticated','mwd_remittance_demo_private.payout_assignments','SELECT')
    OR has_function_privilege('anon','public.mwd_owner_complete_payout_sample_demo(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Exposición inesperada de datos'; END IF;
END $$;
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.mwd_owner_payout_design_summary_demo('00000000-0000-4000-8000-000000000000');
  RAISE EXCEPTION 'Acceso no propietario';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE
 order_id uuid; partner_id uuid;location_id uuid; other_partner uuid;other_location uuid;
 a jsonb;b jsonb;count_events integer;
BEGIN
 a:=public.mwd_owner_remittance_create_demo('NI',10000,'10000000-0000-4000-8000-000000000001');
 order_id:=(a->>'id')::uuid;
 PERFORM public.mwd_owner_remittance_transition_demo(order_id,'review','10000000-0000-4000-8000-000000000002');
 a:=public.mwd_owner_partner_save_demo('Banco ficticio de pruebas','bank','NI');
 partner_id:=(a->>'id')::uuid;
 PERFORM public.mwd_owner_partner_set_status_demo(partner_id,'under_review');
 PERFORM public.mwd_owner_partner_set_status_demo(partner_id,'documented');
 a:=public.mwd_owner_partner_location_save_demo(partner_id,'Sucursal demo','Managua','NIO');
 location_id:=(a->>'id')::uuid;
 a:=public.mwd_owner_partner_save_demo('Banco ficticio destino incorrecto','bank','CR');
 other_partner:=(a->>'id')::uuid;
 PERFORM public.mwd_owner_partner_set_status_demo(other_partner,'under_review');
 PERFORM public.mwd_owner_partner_set_status_demo(other_partner,'documented');
 a:=public.mwd_owner_partner_location_save_demo(other_partner,'Sucursal demo CR','San José','CRC');
 other_location:=(a->>'id')::uuid;
 BEGIN
  PERFORM public.mwd_owner_assign_payout_design_demo(order_id,other_partner,other_location,'10000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'Permitió país equivocado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.mwd_owner_assign_payout_design_demo(order_id,partner_id,other_location,'10000000-0000-4000-8000-000000000004');
  RAISE EXCEPTION 'Permitió sucursal de otro socio';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 a:=public.mwd_owner_assign_payout_design_demo(order_id,partner_id,location_id,'10000000-0000-4000-8000-000000000005');
 b:=public.mwd_owner_assign_payout_design_demo(order_id,partner_id,location_id,'10000000-0000-4000-8000-000000000005');
 IF a->>'id'<>b->>'id' OR b->>'already_processed'<>'true'
 THEN RAISE EXCEPTION 'La asignación no es idempotente'; END IF;
 BEGIN
  PERFORM public.mwd_owner_assign_payout_design_demo(order_id,partner_id,location_id,'10000000-0000-4000-8000-000000000006');
  RAISE EXCEPTION 'Permitió reasignación duplicada';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.mwd_owner_complete_payout_sample_demo(order_id,'10000000-0000-4000-8000-000000000007');
  RAISE EXCEPTION 'Permitió simular retiro antes de completar la remesa';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.mwd_owner_remittance_transition_demo(order_id,'simulated','10000000-0000-4000-8000-000000000008');
 a:=public.mwd_owner_complete_payout_sample_demo(order_id,'10000000-0000-4000-8000-000000000007');
 b:=public.mwd_owner_complete_payout_sample_demo(order_id,'10000000-0000-4000-8000-000000000007');
 IF b->>'already_processed'<>'true' OR a->>'real_payments_enabled'<>'false' OR a->>'redeemable'<>'false'
 THEN RAISE EXCEPTION 'Simulación no es segura'; END IF;
 BEGIN
  PERFORM public.mwd_owner_complete_payout_sample_demo(order_id,'10000000-0000-4000-8000-000000000009');
  RAISE EXCEPTION 'Permitió completar dos veces';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT count(*) INTO count_events FROM mwd_remittance_demo_private.payout_events
 WHERE assignment_id=(a->>'id')::uuid;
 IF count_events<>2 THEN RAISE EXCEPTION 'Eventos inesperados: %',count_events; END IF;
 b:=public.mwd_owner_payout_design_summary_demo(order_id);
 IF b->>'funds_disbursed'<>'false' OR b->>'status'<>'sample_completed'
 THEN RAISE EXCEPTION 'Resumen inconsistente'; END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'Vínculo DEMO probado: país, sucursal, propietario e idempotencia' AS result;
