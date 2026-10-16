-- Moneda Mundial 2.0 | asociación de futuras sucursales con remesas DEMO.
-- Depende de mwd_secure_partner_registry_demo.sql y mwd_owner_remittance_tracking_demo.sql.
-- No usa usuarios beneficiarios, documentos, fondos, códigos o pagos cobrables.
create table if not exists mwd_remittance_demo_private.payout_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references mwd_remittance_demo_private.orders(id) on delete restrict,
  partner_id uuid not null references mwd_partners_private.partners(id) on delete restrict,
  location_id uuid not null references mwd_partners_private.locations(id) on delete restrict,
  currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users(id),
  assignment_request_id uuid not null unique,
  status text not null default 'planned'
    check(status in ('planned','sample_completed')),
  sample_request_id uuid unique,
  created_at timestamptz not null default now(),
  simulated_at timestamptz,
  constraint mwd_payout_demo_completion_consistency check(
   (status='planned' and simulated_at is null and sample_request_id is null)
   or (status='sample_completed' and simulated_at is not null and sample_request_id is not null)
  )
);
comment on table mwd_remittance_demo_private.payout_assignments is
 'Diseño interno: asociación de sucursal CANDIDATA y simulación de entrega; no representa pago ni autorización.';
create index if not exists mwd_demo_payout_assignments_partner
  on mwd_remittance_demo_private.payout_assignments(partner_id);

create table if not exists mwd_remittance_demo_private.payout_events (
 id bigint generated always as identity primary key,
 assignment_id uuid not null references mwd_remittance_demo_private.payout_assignments(id) on delete restrict,
 actor_id uuid not null references auth.users(id),
 request_id uuid not null unique,
 event_type text not null check(event_type in ('assigned','sample_completed')),
 occurred_at timestamptz not null default clock_timestamp(),
 unique(assignment_id,event_type)
);
comment on table mwd_remittance_demo_private.payout_events is
 'Auditoría inmutable de asociación ficticia y simulación (NO entregas de efectivo).';
alter table mwd_remittance_demo_private.payout_assignments enable row level security;
alter table mwd_remittance_demo_private.payout_events enable row level security;
revoke all on mwd_remittance_demo_private.payout_assignments,
 mwd_remittance_demo_private.payout_events from public,anon,authenticated;
revoke all on all sequences in schema mwd_remittance_demo_private
 from public,anon,authenticated;

create or replace function public.mwd_owner_assign_payout_design_demo(
 p_order_id uuid,p_partner_id uuid,p_location_id uuid,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid;
 v_order mwd_remittance_demo_private.orders%rowtype;
 v_partner mwd_partners_private.partners%rowtype;
 v_location mwd_partners_private.locations%rowtype;
 v_existing mwd_remittance_demo_private.payout_assignments%rowtype;
 v_id uuid;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_partner_id is null or p_location_id is null
    or p_request_id is null then
    raise exception 'Parámetros de asociación ficticia inválidos' using errcode='22023';
 end if;

 -- Bloqueo de orden: evita dos asignaciones concurrentes al mismo envío.
 select * into v_order from mwd_remittance_demo_private.orders
 where id=p_order_id for update;
 if not found then raise exception 'Remesa ficticia inexistente' using errcode='22023'; end if;
 select * into v_existing from mwd_remittance_demo_private.payout_assignments
 where order_id=p_order_id for update;
 if found then
   if v_existing.assignment_request_id=p_request_id and
      v_existing.partner_id=p_partner_id and v_existing.location_id=p_location_id then
     return jsonb_build_object('id',v_existing.id,'status',v_existing.status,
       'already_processed',true,'real_payments_enabled',false,'redeemable',false);
   end if;
   raise exception 'Remesa ficticia ya asignada; no se permite duplicar'
      using errcode='22023';
 end if;
 if v_order.status<>'review' then
   raise exception 'La remesa ficticia debe estar en revisión' using errcode='22023';
 end if;

 select * into v_partner from mwd_partners_private.partners
 where id=p_partner_id;
 if not found or v_partner.review_status<>'documented'
    or v_partner.country_code<>v_order.destination_country then
   raise exception 'El candidato no corresponde al destino o requiere revisión documental'
     using errcode='22023';
 end if;
 select * into v_location from mwd_partners_private.locations
 where id=p_location_id;
 if not found or v_location.partner_id<>v_partner.id or
   v_location.review_status<>'draft' then
   raise exception 'Sucursal propuesta inválida para el candidato'
      using errcode='22023';
 end if;

 -- No existe identidad verificada, autorización de agente ni traslado de fondos.
 insert into mwd_remittance_demo_private.payout_assignments(
   order_id,partner_id,location_id,currency_code,created_by,assignment_request_id)
 values(p_order_id,p_partner_id,p_location_id,v_location.currency_code,v_actor,p_request_id)
 returning id into v_id;
 insert into mwd_remittance_demo_private.payout_events(
   assignment_id,actor_id,request_id,event_type)
 values(v_id,v_actor,p_request_id,'assigned');
 return jsonb_build_object('id',v_id,'status','planned',
   'already_processed',false,'real_payments_enabled',false,'redeemable',false);
end; $$;

create or replace function public.mwd_owner_complete_payout_sample_demo(
 p_order_id uuid,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid;
 v_order mwd_remittance_demo_private.orders%rowtype;
 v_assignment mwd_remittance_demo_private.payout_assignments%rowtype;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null then
    raise exception 'Parámetros de ensayo no válidos' using errcode='22023';
 end if;
 select * into v_order from mwd_remittance_demo_private.orders
 where id=p_order_id for update;
 if not found then raise exception 'Remesa inexistente' using errcode='22023'; end if;
 select * into v_assignment from mwd_remittance_demo_private.payout_assignments
 where order_id=p_order_id for update;
 if not found then raise exception 'Primero asocia una sucursal ficticia' using errcode='22023'; end if;
 if v_assignment.status='sample_completed' then
   if v_assignment.sample_request_id=p_request_id then
     return jsonb_build_object('id',v_assignment.id,'status','sample_completed',
      'already_processed',true,'real_payments_enabled',false,'redeemable',false);
   end if;
   raise exception 'Ensayo ya realizado: no puede duplicarse' using errcode='22023';
 end if;
 if v_order.status<>'simulated' then
   raise exception 'Primero completa el seguimiento ficticio de la remesa'
     using errcode='22023';
 end if;
 update mwd_remittance_demo_private.payout_assignments
  set status='sample_completed',sample_request_id=p_request_id,simulated_at=now()
  where id=v_assignment.id and status='planned';
 insert into mwd_remittance_demo_private.payout_events(
   assignment_id,actor_id,request_id,event_type)
 values(v_assignment.id,v_actor,p_request_id,'sample_completed');
 return jsonb_build_object('id',v_assignment.id,'status','sample_completed',
   'already_processed',false,'real_payments_enabled',false,'redeemable',false);
end; $$;

create or replace function public.mwd_owner_payout_design_summary_demo(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or not exists(
   select 1 from mwd_remittance_demo_private.orders where id=p_order_id
 ) then raise exception 'Remesa ficticia inexistente' using errcode='22023'; end if;
 select jsonb_build_object(
   'id',a.id,'status',a.status,'country',p.country_code,
   'partner_name',p.legal_name,'location_name',l.display_name,
   'city',l.city,'currency_code',a.currency_code,
   'events',(select count(*) from mwd_remittance_demo_private.payout_events e
             where e.assignment_id=a.id),
   'real_payments_enabled',false,'redeemable',false,'funds_disbursed',false
 ) into v_result
 from mwd_remittance_demo_private.payout_assignments a
 join mwd_partners_private.partners p on p.id=a.partner_id
 join mwd_partners_private.locations l on l.id=a.location_id
 where a.order_id=p_order_id;
 return coalesce(v_result,jsonb_build_object('status','unassigned',
  'real_payments_enabled',false,'redeemable',false,'funds_disbursed',false));
end; $$;

revoke all on function public.mwd_owner_assign_payout_design_demo(uuid,uuid,uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_complete_payout_sample_demo(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_payout_design_summary_demo(uuid)
 from public,anon,authenticated;
grant execute on function public.mwd_owner_assign_payout_design_demo(uuid,uuid,uuid,uuid)
 to authenticated;
grant execute on function public.mwd_owner_complete_payout_sample_demo(uuid,uuid)
 to authenticated;
grant execute on function public.mwd_owner_payout_design_summary_demo(uuid)
 to authenticated;
