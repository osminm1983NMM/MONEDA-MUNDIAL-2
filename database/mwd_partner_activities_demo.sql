-- MWD 2.0 - agenda interna de reuniones y compromisos de candidatos.
-- No programar notificaciones, contactar terceros ni activar un servicio financiero.
-- Prohibido almacenar datos de identidad, teléfonos, correos o documentos.
create table if not exists mwd_partners_private.partner_activities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references mwd_partners_private.partners(id) on delete restrict,
  activity_kind text not null check (activity_kind in ('meeting_plan','followup','document_review','internal_task')),
  title text not null check(
    char_length(btrim(title)) between 3 and 120
    and title !~* '(@|https?://|www[.])'
    and title !~ '[0-9]{8,}'
  ),
  due_on date not null check (due_on between date '1900-01-01' and date '2100-12-31'),
  activity_status text not null default 'planned'
    check (activity_status in ('planned','completed','cancelled')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table mwd_partners_private.partner_activities is
  'Agenda solo de planificación, sin reuniones programadas automáticamente ni acuerdos financieros operativos.';
create index if not exists mwd_partner_activities_due
  on mwd_partners_private.partner_activities(activity_status,due_on);
create index if not exists mwd_partner_activities_partner
  on mwd_partners_private.partner_activities(partner_id,due_on);
alter table mwd_partners_private.partner_activities enable row level security;
revoke all on mwd_partners_private.partner_activities from public,anon,authenticated;

drop trigger if exists mwd_partner_activities_audit on mwd_partners_private.partner_activities;
create trigger mwd_partner_activities_audit after insert or update
 on mwd_partners_private.partner_activities for each row
 execute function mwd_partners_private.audit_change();

create or replace function public.mwd_owner_partner_activities_demo(
  p_partner_id uuid default null
) returns table(
  id uuid,partner_id uuid,partner_name text,country_code text,
  activity_kind text,title text,due_on date,
  activity_status text,updated_at timestamptz
) language plpgsql security definer set search_path='' as $$
begin
  perform mwd_partners_private.assert_owner();
  return query select a.id,p.id,p.legal_name,p.country_code,
    a.activity_kind,a.title,a.due_on,a.activity_status,a.updated_at
    from mwd_partners_private.partner_activities a
    join mwd_partners_private.partners p on p.id=a.partner_id
    where (p_partner_id is null or p.id=p_partner_id)
    order by case a.activity_status when 'planned' then 0 else 1 end,
      a.due_on asc,a.updated_at desc,a.id
    limit 200;
end; $$;

create or replace function public.mwd_owner_partner_activity_save_demo(
  p_partner_id uuid,p_activity_kind text,p_title text,p_due_on date,
  p_activity_id uuid default null,p_activity_status text default 'planned'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid;
  v_id uuid;
  v_old_status text;
begin
  v_actor:=mwd_partners_private.assert_owner();
  if p_partner_id is null or p_activity_kind is null or p_activity_kind not in
      ('meeting_plan','followup','document_review','internal_task')
     or p_title is null or char_length(btrim(p_title)) not between 3 and 120
     or btrim(p_title) ~* '(@|https?://|www[.])'
     or btrim(p_title) ~ '[0-9]{8,}'
     or p_due_on is null or p_due_on not between date '1900-01-01' and date '2100-12-31'
     or p_activity_status is null or p_activity_status not in ('planned','completed','cancelled')
  then raise exception 'Datos de tarea no válidos; no incluyas datos personales' using errcode='22023';end if;
  perform 1 from mwd_partners_private.partners p
  where p.id=p_partner_id and p.review_status<>'archived' for update;
  if not found then raise exception 'Socio archivado o inexistente' using errcode='22023';end if;

  if p_activity_id is null then
    if p_activity_status<>'planned' then
      raise exception 'Una nueva tarea debe comenzar como planificada' using errcode='22023';
    end if;
    insert into mwd_partners_private.partner_activities
      (partner_id,activity_kind,title,due_on,activity_status,created_by,updated_by)
    values(p_partner_id,p_activity_kind,btrim(p_title),p_due_on,'planned',v_actor,v_actor)
    returning id into v_id;
  else
    select a.activity_status into v_old_status
      from mwd_partners_private.partner_activities a
      where a.id=p_activity_id and a.partner_id=p_partner_id for update;
    if not found then raise exception 'Tarea inexistente' using errcode='22023';end if;
    if v_old_status<>'planned' then
      raise exception 'Solo pueden modificarse tareas planificadas' using errcode='22023';
    end if;
    update mwd_partners_private.partner_activities a
      set activity_kind=p_activity_kind,title=btrim(p_title),due_on=p_due_on,
          activity_status=p_activity_status,updated_by=v_actor,updated_at=now()
      where a.id=p_activity_id and a.partner_id=p_partner_id
      returning a.id into v_id;
  end if;
  return jsonb_build_object(
    'id',v_id,'status',p_activity_status,'real_payments_enabled',false,
    'bank_authorized',false,'notification_sent',false
  );
end; $$;

-- Se incluye agenda y sus cambios en auditoría sin revelar contenido sensible.
create or replace function public.mwd_owner_partner_audit_demo(p_partner_id uuid)
returns table(entity_type text,action text,actor_id uuid,changed_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 perform mwd_partners_private.assert_owner();
 return query select a.entity_type,a.action,a.actor_id,a.changed_at
 from mwd_partners_private.change_audit a
 where a.entity_id=p_partner_id
   or (a.entity_type in ('locations','due_diligence_reviews','engagements','partner_activities')
     and coalesce(a.after_row->>'partner_id',a.before_row->>'partner_id')=p_partner_id::text)
 order by a.changed_at desc,a.id desc limit 100;
end; $$;

revoke all on function public.mwd_owner_partner_activities_demo(uuid)
  from public,anon,authenticated;
revoke all on function public.mwd_owner_partner_activity_save_demo(uuid,text,text,date,uuid,text)
  from public,anon,authenticated;
grant execute on function public.mwd_owner_partner_activities_demo(uuid) to authenticated;
grant execute on function public.mwd_owner_partner_activity_save_demo(uuid,text,text,date,uuid,text) to authenticated;
