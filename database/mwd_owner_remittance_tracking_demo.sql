-- MONEDA MUNDIAL 2.0 — seguimiento de REMESAS FICTICIAS.
-- Sólo simulación administrativa; no vincula billeteras, fondos ni agentes.
-- Nunca genera referencias cobrables ni marca liquidaciones financieras reales.
-- El acceso está restringido en servidor a propietarios de mwd_admin_roles.
create schema if not exists mwd_remittance_demo_private;
revoke all on schema mwd_remittance_demo_private from public, anon, authenticated;

create table if not exists mwd_remittance_demo_private.orders (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  request_id uuid not null,
  source_country text not null default 'US' check (source_country = 'US'),
  destination_country text not null references mwd_finance_private.world_country_catalog(country_code),
  amount_cents bigint not null check (amount_cents between 100 and 10000000),
  status text not null default 'draft'
    check (status in ('draft','review','simulated','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mwd_remittance_demo_idempotent_create unique(created_by, request_id)
);
comment on table mwd_remittance_demo_private.orders is
  'Pedidos de prueba sin beneficiarios, sin fondos y sin capacidad de pago real. Estado simulated significa SOLO ensayo.';
create index if not exists mwd_remittance_demo_orders_recent
  on mwd_remittance_demo_private.orders(updated_at desc);

create table if not exists mwd_remittance_demo_private.events (
  id bigint generated always as identity primary key,
  order_id uuid not null references mwd_remittance_demo_private.orders(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  event_type text not null
    check (event_type in ('created','submitted_for_review','simulation_completed','cancelled')),
  from_status text check (from_status is null or from_status in ('draft','review')),
  to_status text not null check (to_status in ('draft','review','simulated','cancelled')),
  occurred_at timestamptz not null default clock_timestamp(),
  constraint mwd_remittance_demo_event_request_once unique(order_id,request_id)
);
create unique index if not exists mwd_remittance_demo_one_simulated_completion
  on mwd_remittance_demo_private.events(order_id) where to_status='simulated';
create index if not exists mwd_remittance_demo_events_history
  on mwd_remittance_demo_private.events(order_id,id);
comment on table mwd_remittance_demo_private.events is
  'Registro sólo append; registra transiciones ficticias; ninguna fila representa entrega de dinero.';

alter table mwd_remittance_demo_private.orders enable row level security;
alter table mwd_remittance_demo_private.events enable row level security;
revoke all on all tables in schema mwd_remittance_demo_private from public,anon,authenticated;
revoke all on all sequences in schema mwd_remittance_demo_private from public,anon,authenticated;

create or replace function mwd_remittance_demo_private.assert_owner()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.mwd_admin_roles r
    where r.user_id=v_actor and r.role='owner'
  ) then
    raise exception 'Acceso exclusivo del propietario a remesas ficticias'
      using errcode='42501';
  end if;
  return v_actor;
end; $$;
revoke all on function mwd_remittance_demo_private.assert_owner()
  from public,anon,authenticated;

create or replace function public.mwd_owner_remittance_create_demo(
  p_destination_country text, p_amount_cents bigint, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid;
 v_id uuid;
 v_existing mwd_remittance_demo_private.orders%rowtype;
begin
 v_actor := mwd_remittance_demo_private.assert_owner();
 if p_request_id is null or p_destination_country is null or
    p_destination_country !~ '^[A-Z]{2}$' or
    p_amount_cents is null or p_amount_cents not between 100 and 10000000 then
   raise exception 'Datos de simulación de remesa no válidos' using errcode='22023';
 end if;
 insert into mwd_remittance_demo_private.orders
   (created_by,request_id,destination_country,amount_cents)
 values (v_actor,p_request_id,p_destination_country,p_amount_cents)
 on conflict (created_by,request_id) do nothing returning id into v_id;

 if v_id is null then
   select * into v_existing
     from mwd_remittance_demo_private.orders
     where created_by=v_actor and request_id=p_request_id;
   if not found then raise exception 'No se pudo resolver el reintento' using errcode='40001'; end if;
   if v_existing.destination_country is distinct from p_destination_country
      or v_existing.amount_cents is distinct from p_amount_cents then
     raise exception 'Clave de reintento utilizada con otros datos'
       using errcode='22023';
   end if;
   return jsonb_build_object('id',v_existing.id,'status',v_existing.status,
     'already_processed',true,'real_payments_enabled',false,'redeemable',false);
 end if;

 insert into mwd_remittance_demo_private.events
   (order_id,actor_id,request_id,event_type,from_status,to_status)
 values (v_id,v_actor,p_request_id,'created',null,'draft');
 return jsonb_build_object('id',v_id,'status','draft',
    'already_processed',false,'real_payments_enabled',false,'redeemable',false);
end; $$;

create or replace function public.mwd_owner_remittances_demo()
returns table(
  id uuid, source_country text, destination_country text, amount_cents bigint,
  status text, created_at timestamptz, updated_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
 perform mwd_remittance_demo_private.assert_owner();
 return query
 select o.id,o.source_country,o.destination_country,o.amount_cents,
        o.status,o.created_at,o.updated_at
 from mwd_remittance_demo_private.orders o
 order by o.updated_at desc,o.id
 limit 100;
end; $$;

create or replace function public.mwd_owner_remittance_transition_demo(
  p_order_id uuid,p_new_status text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid;
 v_order mwd_remittance_demo_private.orders%rowtype;
 v_previous mwd_remittance_demo_private.events%rowtype;
 v_event_type text;
begin
 v_actor := mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null or
    p_new_status is null or p_new_status not in ('review','simulated','cancelled')
 then raise exception 'Transición ficticia no válida' using errcode='22023'; end if;

 select * into v_order from mwd_remittance_demo_private.orders
   where id=p_order_id for update;
 if not found then raise exception 'Remesa ficticia inexistente' using errcode='22023'; end if;

 select * into v_previous from mwd_remittance_demo_private.events
   where order_id=p_order_id and request_id=p_request_id;
 if found then
   if v_previous.to_status <> p_new_status then
     raise exception 'Clave de reintento utilizada con otro estado'
       using errcode='22023';
   end if;
   return jsonb_build_object('id',p_order_id,'status',v_order.status,
     'already_processed',true,'real_payments_enabled',false,'redeemable',false);
 end if;

 if not (
   (v_order.status='draft' and p_new_status in ('review','cancelled')) or
   (v_order.status='review' and p_new_status in ('simulated','cancelled'))
 ) then
   raise exception 'El cambio de estado no está permitido' using errcode='22023';
 end if;
 v_event_type := case p_new_status
   when 'review' then 'submitted_for_review'
   when 'simulated' then 'simulation_completed'
   else 'cancelled' end;
 update mwd_remittance_demo_private.orders
    set status=p_new_status, updated_at=now()
   where id=p_order_id;
 insert into mwd_remittance_demo_private.events
   (order_id,actor_id,request_id,event_type,from_status,to_status)
 values (p_order_id,v_actor,p_request_id,v_event_type,v_order.status,p_new_status);
 return jsonb_build_object('id',p_order_id,'status',p_new_status,
    'already_processed',false,'real_payments_enabled',false,'redeemable',false);
end; $$;

create or replace function public.mwd_owner_remittance_events_demo(p_order_id uuid)
returns table (
 event_type text,from_status text,to_status text,occurred_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
 perform mwd_remittance_demo_private.assert_owner();
 if not exists (select 1 from mwd_remittance_demo_private.orders o
                where o.id=p_order_id) then
   raise exception 'Remesa ficticia inexistente' using errcode='22023';
 end if;
 return query
 select e.event_type,e.from_status,e.to_status,e.occurred_at
   from mwd_remittance_demo_private.events e
   where e.order_id=p_order_id order by e.id asc limit 100;
end; $$;

revoke all on function public.mwd_owner_remittance_create_demo(text,bigint,uuid)
  from public,anon,authenticated;
revoke all on function public.mwd_owner_remittances_demo()
  from public,anon,authenticated;
revoke all on function public.mwd_owner_remittance_transition_demo(uuid,text,uuid)
  from public,anon,authenticated;
revoke all on function public.mwd_owner_remittance_events_demo(uuid)
  from public,anon,authenticated;
grant execute on function public.mwd_owner_remittance_create_demo(text,bigint,uuid)
  to authenticated;
grant execute on function public.mwd_owner_remittances_demo() to authenticated;
grant execute on function public.mwd_owner_remittance_transition_demo(uuid,text,uuid)
  to authenticated;
grant execute on function public.mwd_owner_remittance_events_demo(uuid)
  to authenticated;
