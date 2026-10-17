-- DEMO ONLY. Override the mock payout closure after installing sample-code modules.
-- Do not deploy or use for real money or identity verification.
create or replace function public.mwd_owner_complete_payout_sample_demo(
 p_order_id uuid,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid;
 v_order mwd_remittance_demo_private.orders%rowtype;
 v_assignment mwd_remittance_demo_private.payout_assignments%rowtype;
 v_sample mwd_remittance_demo_private.pickup_code_samples%rowtype;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null then
   raise exception 'Parametros de prueba invalidos' using errcode='22023';
 end if;
 select * into v_order from mwd_remittance_demo_private.orders where id=p_order_id for update;
 if not found then raise exception 'Orden de prueba inexistente' using errcode='22023'; end if;
 select * into v_assignment from mwd_remittance_demo_private.payout_assignments
 where order_id=p_order_id for update;
 if not found then raise exception 'Sin sucursal candidata' using errcode='22023'; end if;
 if v_assignment.status='sample_completed' then
   if v_assignment.sample_request_id=p_request_id then
     return jsonb_build_object('id',v_assignment.id,'status','sample_completed',
       'already_processed',true,'money_paid',false,'real_payments_enabled',false,'redeemable',false);
   end if;
   raise exception 'Entrega de prueba ya cerrada' using errcode='22023';
 end if;
 if v_assignment.status<>'planned' or v_order.status<>'simulated' then
   raise exception 'Orden de demostracion no lista' using errcode='22023';
 end if;
 select * into v_sample from mwd_remittance_demo_private.pickup_code_samples
 where assignment_id=v_assignment.id for update;
 if not found or v_sample.status<>'consumed' or v_sample.consume_request_id is null
  or v_sample.identity_check_simulated_at is null
  or not exists(select 1 from mwd_remittance_demo_private.pickup_code_events e
                where e.sample_id=v_sample.id and e.action='consumed') then
   raise exception 'Falta consumir el codigo ficticio y la revision simulada'
     using errcode='22023';
 end if;
 update mwd_remittance_demo_private.payout_assignments
 set status='sample_completed',sample_request_id=p_request_id,simulated_at=now()
 where id=v_assignment.id and status='planned';
 insert into mwd_remittance_demo_private.payout_events(assignment_id,actor_id,request_id,event_type)
 values(v_assignment.id,v_actor,p_request_id,'sample_completed');
 return jsonb_build_object('id',v_assignment.id,'status','sample_completed',
   'already_processed',false,'identity_real_verified',false,'money_paid',false,
   'real_payments_enabled',false,'redeemable',false);
end; $$;
revoke all on function public.mwd_owner_complete_payout_sample_demo(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.mwd_owner_complete_payout_sample_demo(uuid,uuid)
 to authenticated;


-- Capability handshake: created only together with the safe DEMO payout closure.
-- Plain SECURITY INVOKER, no private table access and no customer information.
-- A missing function or any unexpected response must leave the Android
-- completion button hidden until this DEMO migration is installed.
create or replace function public.mwd_demo_payout_closure_capability()
returns jsonb language sql stable security invoker set search_path='' as $cap$
  select jsonb_build_object(
    'version',1,
    'demo_only',true,
    'closure_requires_consumed_code',true,
    'real_payments_enabled',false
  )
  where auth.uid() is not null
$cap$;
revoke all on function public.mwd_demo_payout_closure_capability()
  from public,anon,authenticated;
grant execute on function public.mwd_demo_payout_closure_capability()
  to authenticated;
