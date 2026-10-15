-- MONEDA MUNDIAL 2.0 — registro permanente de socios de demostración.
-- NO crea agentes habilitados, acuerdos, pagos reales ni códigos cobrables.
-- El catálogo financiero existente continúa con real_payments_enabled = false.

create schema if not exists mwd_partners_private;
revoke all on schema mwd_partners_private from public, anon, authenticated;

create table if not exists mwd_partners_private.partners (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 150),
  partner_kind text not null check (partner_kind in
    ('bank','remittance_company','agent_network','payment_institution')),
  country_code text not null references mwd_finance_private.world_country_catalog(country_code),
  review_status text not null default 'draft' check (review_status in
    ('draft','under_review','needs_changes','documented','archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table mwd_partners_private.partners is
  'Solo registro de planificación, no habilita pagos ni representa acuerdos vigentes. documented no significa licencia.';
create index if not exists mwd_partners_country_kind
  on mwd_partners_private.partners (country_code, partner_kind);

create table if not exists mwd_partners_private.locations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references mwd_partners_private.partners(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 140),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  hours_note text check (hours_note is null or char_length(hours_note) <= 140),
  review_status text not null default 'draft' check (review_status = 'draft'),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table mwd_partners_private.locations is
  'Sucursales propuestas, nunca puntos de retiro operativos.';
create index if not exists mwd_partner_locations_by_partner
  on mwd_partners_private.locations (partner_id);

create table if not exists mwd_partners_private.change_audit (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE')),
  before_row jsonb,
  after_row jsonb,
  actor_id uuid,
  changed_at timestamptz not null default clock_timestamp()
);
create index if not exists mwd_partner_audit_by_entity
  on mwd_partners_private.change_audit (entity_id, changed_at desc);
comment on table mwd_partners_private.change_audit is
  'Historial interno, solo append vía triggers; ningún cliente puede modificarlo.';

alter table mwd_partners_private.partners enable row level security;
alter table mwd_partners_private.locations enable row level security;
alter table mwd_partners_private.change_audit enable row level security;
revoke all on all tables in schema mwd_partners_private from public, anon, authenticated;
revoke all on all sequences in schema mwd_partners_private from public, anon, authenticated;

create or replace function mwd_partners_private.assert_owner()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.mwd_admin_roles r
    where r.user_id = v_actor and r.role = 'owner'
  ) then
    raise exception 'Acceso exclusivo del propietario'
      using errcode = '42501';
  end if;
  return v_actor;
end; $$;

create or replace function mwd_partners_private.audit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into mwd_partners_private.change_audit
    (entity_type,entity_id,action,before_row,after_row,actor_id)
  values (
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end,
    to_jsonb(NEW),
    auth.uid()
  );
  return null; -- AFTER trigger
end; $$;

drop trigger if exists mwd_partners_audit_change on mwd_partners_private.partners;
create trigger mwd_partners_audit_change
after insert or update on mwd_partners_private.partners
for each row execute function mwd_partners_private.audit_change();

drop trigger if exists mwd_locations_audit_change on mwd_partners_private.locations;
create trigger mwd_locations_audit_change
after insert or update on mwd_partners_private.locations
for each row execute function mwd_partners_private.audit_change();

revoke all on all functions in schema mwd_partners_private
  from public, anon, authenticated;

create or replace function public.mwd_owner_partner_save_demo(
  p_legal_name text, p_partner_kind text, p_country_code text,
  p_partner_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_id uuid;
  v_status text;
begin
  v_actor := mwd_partners_private.assert_owner();
  if p_legal_name is null or char_length(btrim(p_legal_name)) not between 2 and 150
     or p_partner_kind not in ('bank','remittance_company','agent_network','payment_institution')
     or p_partner_kind is null
     or p_country_code is null or p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Datos del socio no válidos' using errcode='22023';
  end if;

  if p_partner_id is null then
    insert into mwd_partners_private.partners
      (legal_name, partner_kind, country_code, created_by, updated_by)
    values (btrim(p_legal_name),p_partner_kind,p_country_code,v_actor,v_actor)
    returning id,review_status into v_id,v_status;
  else
    update mwd_partners_private.partners p
       set legal_name=btrim(p_legal_name),
           partner_kind=p_partner_kind,
           country_code=p_country_code,
           review_status='draft',
           updated_by=v_actor,
           updated_at=now()
     where p.id=p_partner_id and p.review_status in ('draft','needs_changes')
     returning p.id,p.review_status into v_id,v_status;
    if not found then
      raise exception 'Socio no editable o inexistente' using errcode='42501';
    end if;
  end if;

  return jsonb_build_object('id',v_id,'review_status',v_status,
    'real_payouts_enabled',false);
end; $$;

create or replace function public.mwd_owner_partners_demo()
returns table (
  id uuid,legal_name text,partner_kind text,country_code text,
  review_status text, updated_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  perform mwd_partners_private.assert_owner();
  return query
  select p.id,p.legal_name,p.partner_kind,p.country_code,p.review_status,p.updated_at
    from mwd_partners_private.partners p
    order by p.updated_at desc,p.id
    limit 200;
end; $$;

create or replace function public.mwd_owner_partner_set_status_demo(
  p_partner_id uuid, p_new_status text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_before text;
begin
  v_actor := mwd_partners_private.assert_owner();
  select p.review_status into v_before
    from mwd_partners_private.partners p
    where p.id=p_partner_id for update;
  if not found then
    raise exception 'Socio inexistente' using errcode='22023';
  end if;
  if not (
    (v_before in ('draft','needs_changes') and p_new_status='under_review')
    or (v_before='under_review' and p_new_status in ('needs_changes','documented'))
    or (v_before='documented' and p_new_status='archived')
  ) then
    raise exception 'Transición de revisión no permitida' using errcode='22023';
  end if;
  update mwd_partners_private.partners p
    set review_status=p_new_status, updated_by=v_actor, updated_at=now()
    where p.id=p_partner_id;
  return jsonb_build_object('id',p_partner_id,'review_status',p_new_status,
    'real_payouts_enabled',false);
end; $$;

create or replace function public.mwd_owner_partner_location_save_demo(
  p_partner_id uuid, p_display_name text, p_city text,
  p_currency_code text, p_hours_note text default null,
  p_location_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_id uuid;
  v_status text;
begin
  v_actor := mwd_partners_private.assert_owner();
  if not exists (select 1 from mwd_partners_private.partners p
      where p.id=p_partner_id and p.review_status <> 'archived') then
    raise exception 'Socio no disponible' using errcode='22023';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 140
     or p_city is null or char_length(btrim(p_city)) not between 2 and 100
     or p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$'
     or char_length(coalesce(p_hours_note,'')) > 140 then
    raise exception 'Datos de sucursal no válidos' using errcode='22023';
  end if;
  if p_location_id is null then
    insert into mwd_partners_private.locations
      (partner_id,display_name,city,currency_code,hours_note,created_by,updated_by)
    values (p_partner_id,btrim(p_display_name),btrim(p_city),
      p_currency_code,nullif(btrim(coalesce(p_hours_note,'')),''),v_actor,v_actor)
    returning id into v_id;
  else
    update mwd_partners_private.locations l
       set display_name=btrim(p_display_name),city=btrim(p_city),
           currency_code=p_currency_code,
           hours_note=nullif(btrim(coalesce(p_hours_note,'')),''),
           updated_by=v_actor,updated_at=now()
     where l.id=p_location_id and l.partner_id=p_partner_id
    returning id into v_id;
    if not found then
      raise exception 'Sucursal inexistente' using errcode='22023';
    end if;
  end if;
  return jsonb_build_object('id',v_id,'review_status','draft',
    'real_payouts_enabled',false);
end; $$;

create or replace function public.mwd_owner_partner_locations_demo(p_partner_id uuid)
returns table(
  id uuid,display_name text,city text,currency_code text,
  hours_note text,review_status text,updated_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  perform mwd_partners_private.assert_owner();
  return query
  select l.id,l.display_name,l.city,l.currency_code,l.hours_note,
         l.review_status,l.updated_at
  from mwd_partners_private.locations l
  where l.partner_id=p_partner_id
  order by l.updated_at desc limit 200;
end; $$;

create or replace function public.mwd_owner_partner_audit_demo(p_partner_id uuid)
returns table(entity_type text,action text,actor_id uuid,changed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform mwd_partners_private.assert_owner();
  return query
  select a.entity_type,a.action,a.actor_id,a.changed_at
    from mwd_partners_private.change_audit a
    where a.entity_id=p_partner_id
       or (a.entity_type='locations'
           and (a.after_row->>'partner_id')=p_partner_id::text)
    order by a.changed_at desc limit 100;
end; $$;

revoke all on function public.mwd_owner_partner_save_demo(text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.mwd_owner_partners_demo() from public,anon,authenticated;
revoke all on function public.mwd_owner_partner_set_status_demo(uuid,text) from public,anon,authenticated;
revoke all on function public.mwd_owner_partner_location_save_demo(uuid,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.mwd_owner_partner_locations_demo(uuid) from public,anon,authenticated;
revoke all on function public.mwd_owner_partner_audit_demo(uuid) from public,anon,authenticated;
grant execute on function public.mwd_owner_partner_save_demo(text,text,text,uuid) to authenticated;
grant execute on function public.mwd_owner_partners_demo() to authenticated;
grant execute on function public.mwd_owner_partner_set_status_demo(uuid,text) to authenticated;
grant execute on function public.mwd_owner_partner_location_save_demo(uuid,text,text,text,text,uuid) to authenticated;
grant execute on function public.mwd_owner_partner_locations_demo(uuid) to authenticated;
grant execute on function public.mwd_owner_partner_audit_demo(uuid) to authenticated;