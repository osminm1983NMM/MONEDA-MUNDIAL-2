-- PostgreSQL CI exclusivamente: comprueba que un código ficticio vencido
-- nunca permite cerrar una entrega de demostración.
-- Ejecutar DESPUÉS de payout-closure-code-assertions.sql. Sin dinero real.
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE partner_id uuid; location_id uuid; order_id uuid; response jsonb;
BEGIN
 response:=public.mwd_owner_partner_save_demo('QA banco caducidad','bank','NI');
 partner_id:=(response->>'id')::uuid;
 PERFORM public.mwd_owner_partner_set_status_demo(partner_id,'under_review');
 PERFORM public.mwd_owner_partner_set_status_demo(partner_id,'documented');
 response:=public.mwd_owner_partner_location_save_demo(partner_id,'Sucursal vencimiento','Managua','NIO');
 location_id:=(response->>'id')::uuid;
 response:=public.mwd_owner_remittance_create_demo('NI',10000,gen_random_uuid());
 order_id:=(response->>'id')::uuid;
 PERFORM public.mwd_owner_remittance_transition_demo(order_id,'review',gen_random_uuid());
 PERFORM public.mwd_owner_assign_payout_design_demo(order_id,partner_id,location_id,gen_random_uuid());
 PERFORM public.mwd_owner_remittance_transition_demo(order_id,'simulated',gen_random_uuid());
 response:=public.mwd_owner_issue_pickup_code_demo(order_id,gen_random_uuid());
 IF response->>'status'<>'active' THEN RAISE EXCEPTION 'El código de prueba no se emitió'; END IF;
 PERFORM set_config('test.mwd_expired_order',order_id::text,false);
END $$;
RESET ROLE;
-- Sólo el administrador del PostgreSQL desechable de CI altera el reloj
-- del fixture. Los usuarios móviles no poseen estos permisos.
DO $$
DECLARE changed_count integer;
BEGIN
 UPDATE mwd_remittance_demo_private.pickup_code_samples c
 SET created_at=now()-interval '2 minutes',
     expires_at=now()-interval '1 minute'
 WHERE c.assignment_id=(
  SELECT a.id FROM mwd_remittance_demo_private.payout_assignments a
  WHERE a.order_id=current_setting('test.mwd_expired_order')::uuid
 ) AND c.status='active';
 GET DIAGNOSTICS changed_count=ROW_COUNT;
 IF changed_count<>1 THEN RAISE EXCEPTION 'No se preparó el código vencido'; END IF;
END $$;
SET ROLE authenticated;
DO $$
DECLARE order_id uuid:=current_setting('test.mwd_expired_order')::uuid;
 response jsonb; audit jsonb;
BEGIN
 response:=public.mwd_owner_try_pickup_code_demo(order_id,'INVALID',gen_random_uuid());
 IF response->>'status'<>'expired' OR response->>'accepted'<>'false'
 THEN RAISE EXCEPTION 'Código vencido aceptado por el simulador'; END IF;
 BEGIN
  PERFORM public.mwd_owner_complete_payout_sample_demo(order_id,gen_random_uuid());
  RAISE EXCEPTION 'Cierre DEMO permitió código vencido';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 audit:=public.mwd_owner_payout_design_summary_demo(order_id);
 IF audit->>'status'<>'planned' OR audit->>'funds_disbursed'<>'false'
 OR audit->>'events'<>'1' THEN
  RAISE EXCEPTION 'Entrega ficticia quedó alterada pese a código vencido: %',audit;
 END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'CI: un código vencido no puede cerrar entrega ficticia' AS result;
