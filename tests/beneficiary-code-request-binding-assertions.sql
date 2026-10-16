-- Ensayo de reintentos maliciosos/accidentales en PostgreSQL desechable.
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE p uuid;l uuid;o uuid;r jsonb;a jsonb;b jsonb;token text;
 wrong_id uuid:='70000000-0000-4000-8000-000000000006';
 good_id uuid:='70000000-0000-4000-8000-000000000009';
BEGIN
 r:=public.mwd_owner_partner_save_demo('Banco ficticio reintentos','bank','NI');
 p:=(r->>'id')::uuid;
 perform public.mwd_owner_partner_set_status_demo(p,'under_review');
 perform public.mwd_owner_partner_set_status_demo(p,'documented');
 r:=public.mwd_owner_partner_location_save_demo(p,'Sucursal ficticia QA','Managua','NIO');
 l:=(r->>'id')::uuid;
 r:=public.mwd_owner_remittance_create_demo('NI',10000,'70000000-0000-4000-8000-000000000001');
 o:=(r->>'id')::uuid;
 perform public.mwd_owner_remittance_transition_demo(o,'review','70000000-0000-4000-8000-000000000002');
 perform public.mwd_owner_assign_payout_design_demo(o,p,l,'70000000-0000-4000-8000-000000000003');
 perform public.mwd_owner_remittance_transition_demo(o,'simulated','70000000-0000-4000-8000-000000000004');
 r:=public.mwd_owner_issue_pickup_code_demo(o,'70000000-0000-4000-8000-000000000005');
 token:=r->>'demo_code_once';
 if token !~ '^DEMO-[0-9A-F]{32}$' then raise exception 'Token sin formato';end if;
 a:=public.mwd_owner_try_pickup_code_demo(o,'DEMO-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',wrong_id);
 if a->>'remaining_attempts'<>'4' then raise exception 'Primer fallo no contabilizado';end if;
 b:=public.mwd_owner_try_pickup_code_demo(o,'DEMO-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',wrong_id);
 if b->>'already_processed'<>'true' or b->>'remaining_attempts'<>'4' then
   raise exception 'Reintento exacto no idempotente'; end if;
 begin
  perform public.mwd_owner_try_pickup_code_demo(o,token,wrong_id);
  raise exception 'Se aceptó UUID reutilizado con otro código';
 exception when sqlstate '22023' then null;
 end;
 b:=public.mwd_owner_pickup_code_summary_demo(o);
 if b->>'remaining_attempts'<>'4' or b->>'status'<>'active'
 then raise exception 'Estado alterado por reintento inválido';end if;
 perform public.mwd_owner_mock_beneficiary_check_demo(o,'70000000-0000-4000-8000-000000000008');
 a:=public.mwd_owner_try_pickup_code_demo(o,token,good_id);
 if a->>'accepted'<>'true' or a->>'money_paid'<>'false'
 then raise exception 'Consumo DEMO no completado';end if;
 b:=public.mwd_owner_try_pickup_code_demo(o,token,good_id);
 if b->>'already_processed'<>'true' or b->>'status'<>'consumed'
 then raise exception 'No se recuperó resultado idempotente';end if;
 begin
  perform public.mwd_owner_try_pickup_code_demo(o,'DEMO-00000000000000000000000000000000',good_id);
  raise exception 'Se aceptó replay de resultado positivo con otro código';
 exception when sqlstate '22023' then null;
 end;
 b:=public.mwd_owner_try_pickup_code_demo(o,token,gen_random_uuid());
 if b->>'accepted'<>'false' or b->>'status'<>'consumed'
 then raise exception 'Se aceptó un segundo retiro';end if;
 b:=public.mwd_owner_pickup_code_summary_demo(o);
 if b->>'events'<>'4' then raise exception 'Auditoría duplicada';end if;
 perform set_config('test.mwd_sample_id',b->>'id',false);
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (select count(*) from mwd_remittance_demo_private.pickup_code_attempts
    where sample_id=current_setting('test.mwd_sample_id')::uuid
      and request_fingerprint is null)<>0
 THEN raise exception 'Intentos sin huella registrada'; END IF;
END $$;
RESET request.jwt.claim.sub;
SELECT 'UUID reutilizados y consumo duplicado bloqueados en DEMO' AS result;
