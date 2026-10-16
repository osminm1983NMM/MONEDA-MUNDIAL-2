-- MONEDA MUNDIAL 2.0 | SEGURIDAD DE AGENTES DE DEMOSTRACIÓN
-- SOLO ENTORNO DE PRUEBA. No acredita instituciones ni habilita pagos.
-- Requiere mwd_pickup_without_phone_demo.sql y mwd_secure_partner_registry_demo.sql.
-- Todas las tablas en esquema no expuesto: accesibles sólo mediante RPC con controles.

create schema if not exists mwd_agents_private;
revoke all on schema mwd_agents_private from public,anon,authenticated;

create table if not exists mwd_agents_private.demo_assignments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references mwd_partners_private.partners(id),
  status text not null check(status in ('active','suspended','revoked')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(user_id,partner_id)
);
create index if not exists demo_agent_user_status
  on mwd_agents_private.demo_assignments(user_id,status,expires_at);

create table if not exists mwd_agents_private.demo_assignment_audit(
  id bigint generated always as identity primary key,
  assignment_id uuid not null references mwd_agents_private.demo_assignments(id),
  actor_id uuid not null references auth.users(id),
  previous_status text,
  new_status text not null,
  reason text not null check(length(reason) between 10 and 200),
  recorded_at timestamptz not null default clock_timestamp()
);
create index if not exists demo_assignment_audit_time
  on mwd_agents_private.demo_assignment_audit(recorded_at desc,id desc);

alter table mwd_agents_private.demo_assignments enable row level security;
alter table mwd_agents_private.demo_assignment_audit enable row level security;
revoke all on all tables in schema mwd_agents_private from public,anon,authenticated;
revoke all on all sequences in schema mwd_agents_private from public,anon,authenticated;

-- Asignar/revocar rol SOLAMENTE de consulta de alcance simulado.
-- Los socios son candidatos; aun con estado active NO pueden ver remesas,
-- conocer códigos, alterar operaciones, simular entregas ni mover dinero.
create or replace function public.mwd_owner_agent_access_demo(
 p_user_id uuid, p_partner_id uuid, p_action text, p_reason text,
 p_valid_days integer default 14
) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare
 v_actor uuid;
 v_previous mwd_agents_private.demo_assignments%rowtype;
 v_new_id uuid;
 v_status text;
 v_expiry timestamptz;
 v_reason text:=btrim(coalesce(p_reason,''));
begin
 v_actor:=mwd_partners_private.assert_owner();
 if p_user_id is null or p_partner_id is null
    or p_user_id=v_actor
    or p_action is null or p_action not in ('enable','suspend','revoke')
    or p_valid_days is null or p_valid_days not between 1 and 30
    or char_length(v_reason) not between 10 and 200 then
   raise exception 'Parámetros administrativos no válidos' using errcode='22023';
 end if;
 if not exists(select 1 from auth.users where id=p_user_id) then
   raise exception 'La cuenta de prueba no existe' using errcode='22023';
 end if;
 if not exists(select 1 from mwd_partners_private.partners p
   where p.id=p_partner_id and p.review_status<>'archived') then
   raise exception 'Institución candidata no disponible' using errcode='22023';
 end if;

 v_status:=case p_action when 'enable' then 'active'
    when 'suspend' then 'suspended' else 'revoked' end;
 v_expiry:=clock_timestamp()+make_interval(days=>p_valid_days);

 select * into v_previous from mwd_agents_private.demo_assignments
   where user_id=p_user_id and partner_id=p_partner_id for update;
 if not found then
   if p_action <> 'enable' then
     raise exception 'No hay permiso de prueba previo' using errcode='22023';
   end if;
   insert into mwd_agents_private.demo_assignments
     (user_id,partner_id,status,expires_at,created_by,updated_by)
   values(p_user_id,p_partner_id,v_status,v_expiry,v_actor,v_actor)
   returning id into v_new_id;
 else
   v_new_id:=v_previous.id;
   update mwd_agents_private.demo_assignments
     set status=v_status,
         expires_at=case when p_action='enable' then v_expiry else expires_at end,
         updated_by=v_actor,updated_at=clock_timestamp()
   where id=v_new_id;
 end if;

 insert into mwd_agents_private.demo_assignment_audit
   (assignment_id,actor_id,previous_status,new_status,reason)
 values(v_new_id,v_actor,v_previous.status,v_status,v_reason);

 return jsonb_build_object('status',v_status,'assignmentId',v_new_id,
   'readOnly',true,'canViewOrders',false,'canSimulatePickup',false,
   'realPaymentsEnabled',false);
end; $fn$;

create or replace function public.mwd_owner_agent_list_demo()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_list jsonb;
begin
 perform mwd_partners_private.assert_owner();
 select coalesce(jsonb_agg(jsonb_build_object(
  'assignmentId',a.id,'userId',a.user_id,'partnerId',a.partner_id,
  'partnerName',p.legal_name,'country',p.country_code,
  'status',a.status,'expiresAt',a.expires_at,'updatedAt',a.updated_at,
  'accessNow',(a.status='active' and a.expires_at>clock_timestamp()
      and p.review_status<>'archived')
 ) order by a.updated_at desc,a.id),'[]'::jsonb)
 into v_list from (
  select * from mwd_agents_private.demo_assignments
  order by updated_at desc,id limit 100
 ) a join mwd_partners_private.partners p on p.id=a.partner_id;
 return v_list;
end; $fn$;

create or replace function public.mwd_owner_agent_audit_demo()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_history jsonb;
begin
 perform mwd_partners_private.assert_owner();
 select coalesce(jsonb_agg(jsonb_build_object(
   'eventId',e.id,'assignmentId',e.assignment_id,'actorId',e.actor_id,
   'before',e.previous_status,'after',e.new_status,
   'reason',e.reason,'at',e.recorded_at
 ) order by e.recorded_at desc,e.id desc),'[]'::jsonb)
 into v_history from (select * from mwd_agents_private.demo_assignment_audit
   order by recorded_at desc,id desc limit 50) e;
 return v_history;
end; $fn$;

create or replace function public.mwd_agent_my_scope_demo()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid(); v_scopes jsonb;
begin
 if v_actor is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'partnerName',p.legal_name,'country',p.country_code,
  'expiresAt',a.expires_at,'readOnly',true,
  'canViewOrders',false,'canSimulatePickup',false
 ) order by p.country_code,p.legal_name),'[]'::jsonb) into v_scopes
 from mwd_agents_private.demo_assignments a
 join mwd_partners_private.partners p on p.id=a.partner_id
 where a.user_id=v_actor and a.status='active'
   and a.expires_at>clock_timestamp() and p.review_status<>'archived';
 return jsonb_build_object('mode','demo_only','scopes',v_scopes,
  'realPaymentsEnabled',false,'canPayCash',false);
end; $fn$;

-- Anti-abuso: máximo cinco órdenes nuevas en una hora y tres pendientes
-- por cuenta. Serialización por usuario para evitar saltar límites en carrera.
-- No altera el flujo de cancelación ni de comprobantes ya emitidos.
create or replace function mwd_pickup_private.demo_order_quota_guard()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if auth.uid() is null or new.sender_user_id is distinct from auth.uid() then
   raise exception 'No autorizado para crear esta solicitud' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(891022,
   pg_catalog.hashtext(new.sender_user_id::text));
 if (select count(*) from mwd_pickup_private.demo_orders o
     where o.sender_user_id=new.sender_user_id
     and o.created_at>clock_timestamp()-interval '1 hour') >= 5 then
   raise exception 'Límite horario de solicitudes de prueba' using errcode='22023';
 end if;
 if (select count(*) from mwd_pickup_private.demo_orders o
     where o.sender_user_id=new.sender_user_id
       and o.status='pending' and o.expires_at>clock_timestamp()) >= 3 then
   raise exception 'Demasiadas solicitudes de prueba pendientes' using errcode='22023';
 end if;
 return new;
end; $fn$;
revoke all on function mwd_pickup_private.demo_order_quota_guard()
 from public,anon,authenticated;
drop trigger if exists demo_order_quota_before_insert on mwd_pickup_private.demo_orders;
create trigger demo_order_quota_before_insert before insert
 on mwd_pickup_private.demo_orders for each row
 execute function mwd_pickup_private.demo_order_quota_guard();

revoke all on function public.mwd_owner_agent_access_demo(uuid,uuid,text,text,integer)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_agent_list_demo()
 from public,anon,authenticated;
revoke all on function public.mwd_owner_agent_audit_demo()
 from public,anon,authenticated;
revoke all on function public.mwd_agent_my_scope_demo()
 from public,anon,authenticated;
grant execute on function public.mwd_owner_agent_access_demo(uuid,uuid,text,text,integer)
 to authenticated;
grant execute on function public.mwd_owner_agent_list_demo() to authenticated;
grant execute on function public.mwd_owner_agent_audit_demo() to authenticated;
grant execute on function public.mwd_agent_my_scope_demo() to authenticated;
