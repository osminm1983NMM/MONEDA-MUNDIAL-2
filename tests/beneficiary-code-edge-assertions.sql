-- Ensayos de borde: caducidad, cancelación y cinco intentos.
-- Sólo una base PostgreSQL de CI; ningún beneficiario real.
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE p uuid;l uuid;o uuid;r jsonb;a jsonb;b jsonb;token text;i integer;
BEGIN
 r:=public.mwd_owner_partner_save_demo('Banco prueba de límites','bank','NI');
 p:=(r->>'id')::uuid;
 PERFORM public.mwd_owner_partner_set_status_demo(p,'under_review');
 PERFORM public.mwd_owner_partner_set_status_demo(p,'documented');
 r:=public.mwd_owner_partner_location_save_demo(p,'Sucursal ficticia QA','Managua','NIO');
 l:=(r->>'id')::uuid;
 FOR i IN 1..3 LOOP
   r:=public.mwd_owner_remittance_create_demo('NI',10000,
      ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid);
   o:=(r->>'id')::uuid;
   PERFORM public.mwd_owner_remittance_transition_demo(o,'review',gen_random_uuid());
   PERFORM public.mwd_owner_assign_payout_design_demo(o,p,l,gen_random_uuid());
   PERFORM public.mwd_owner_remittance_transition_demo(o,'simulated',gen_random_uuid());
   r:=public.mwd_owner_issue_pickup_code_demo(o,gen_random_uuid());
   token:=r->>'demo_code_once';
   IF i=1 THEN
      PERFORM public.mwd_owner_cancel_pickup_code_demo(o);
      a:=public.mwd_owner_try_pickup_code_demo(o,token,gen_random_uuid());
      IF a->>'accepted'<>'false' OR a->>'status'<>'cancelled'
        THEN RAISE EXCEPTION 'Código cancelado aceptado'; END IF;
   ELSIF i=2 THEN
      -- Cinco códigos incorrectos: el quinto bloquea definitivamente.
      FOR j IN 1..5 LOOP
       a:=public.mwd_owner_try_pickup_code_demo(o,'DEMO-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',gen_random_uuid());
       IF a->>'remaining_attempts'<>(5-j)::text THEN
         RAISE EXCEPTION 'Conteo incorrecto de intentos'; END IF;
      END LOOP;
      a:=public.mwd_owner_try_pickup_code_demo(o,token,gen_random_uuid());
      IF a->>'status'<>'locked' OR a->>'accepted'<>'false'
        THEN RAISE EXCEPTION 'Código bloqueado aceptado'; END IF;
   ELSE
      -- La prueba de caducidad utiliza una modificación exclusivamente local
      -- del fixture (no es una API ni permiso disponible para clientes).
      NULL;
   END IF;
 END LOOP;
END $$;
RESET ROLE;
-- Expiración: manipular reloj únicamente en el PostgreSQL desechable de CI.
DO $$
DECLARE v_sample uuid;v_order uuid;
BEGIN
 SELECT c.id,o.id INTO v_sample,v_order
 FROM mwd_remittance_demo_private.pickup_code_samples c
 JOIN mwd_remittance_demo_private.payout_assignments a ON a.id=c.assignment_id
 JOIN mwd_remittance_demo_private.orders o ON o.id=a.order_id
 ORDER BY c.created_at DESC,c.id DESC LIMIT 1;
 UPDATE mwd_remittance_demo_private.pickup_code_samples
 SET expires_at=now()-interval '1 second'
 WHERE id=v_sample AND status='active';
 PERFORM set_config('test.expired_order',v_order::text,false);
END $$;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE a jsonb;v_order uuid:=current_setting('test.expired_order')::uuid;
BEGIN
 a:=public.mwd_owner_try_pickup_code_demo(v_order,'INVALID',gen_random_uuid());
 IF a->>'status'<>'expired' OR a->>'accepted'<>'false'
 THEN RAISE EXCEPTION 'Código vencido aceptado'; END IF;
 a:=public.mwd_owner_pickup_code_summary_demo(v_order);
 IF a->>'status'<>'expired' THEN RAISE EXCEPTION 'Estado de vencimiento incorrecto'; END IF;
END $$;
RESET ROLE;RESET request.jwt.claim.sub;
SELECT 'Códigos: cancelación, límite de cinco intentos y caducidad OK' AS result;
