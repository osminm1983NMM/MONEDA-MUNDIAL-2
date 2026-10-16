-- Moneda Mundial 2.0 - Seguimiento INTERNO de propuestas de colaboración.
-- Solo metadatos no sensibles; no almacenar contactos personales, documentos,
-- claves, números de contrato o cuentas. NUNCA habilita retiros o pagos reales.
create table if not exists mwd_partners_private.engagements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references mwd_partners_private.partners(id) on delete restrict,
  stage text not null default 'not_contacted' check (stage in (
    'not_contacted','outreach_planned','contact_recorded',
    'discussion','due_diligence','draft_contract_review','paused','closed'
  )),
  next_followup date check (next_followup is null or next_followup between date '1900-01-01' and date '2100-12-31'),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mwd_engagement_closed_without_followup check (stage <> 'closed' or next_followup is null)
);
comment on table mwd_partners_private.engagements is
  'Seguimiento administrativo de candidatos; ninguna etapa significa licencia, contrato firmado ni habilitación financiera.';
alter table mwd_partners_private.engagements enable row level security;
revoke all on mwd_partners_private.engagements from public,anon,authenticated;
create index if not exists mwd_engagement_followups on mwd_partners_private.engagements(next_followup)
 where next_followup is not null;

drop trigger if exists mwd_engagements_audit on mwd_partners_private.engagements;
create trigger mwd_engagements_audit after insert or update on mwd_partners_private.engagements
 for each row execute function mwd_partners_private.audit_change();

create or replace function public.mwd_owner_partner_engagement_demo(p_partner_id uuid)
returns table(stage text,next_followup date,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 perform mwd_partners_private.assert_owner();
 if p_partner_id is null or not exists
 (select 1 from mwd_partners_private.partners p where p.id=p_partner_id)
 then raise exception 'Candidato no encontrado' using errcode='22023';end if;
 return query
 select coalesce(e.stage,'not_contacted'::text),e.next_followup,e.updated_at
 from (select 1) seed left join mwd_partners_private.engagements e
 on e.partner_id=p_partner_id;
end; $$;

create or replace function public.mwd_owner_partner_engagement_save_demo(
  p_partner_id uuid,p_stage text,p_next_followup date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;
begin
 v_actor := mwd_partners_private.assert_owner();
 if p_partner_id is null or p_stage is null or p_stage not in (
 'not_contacted','outreach_planned','contact_recorded','discussion',
 'due_diligence','draft_contract_review','paused','closed'
 ) or (p_stage='closed' and p_next_followup is not null)
 or (p_next_followup is not null and
     p_next_followup not between date '1900-01-01' and date '2100-12-31')
 then raise exception 'Estado o fecha no válidos' using errcode='22023';end if;
 perform 1 from mwd_partners_private.partners p
 where p.id=p_partner_id and p.review_status<>'archived' for update;
 if not found then raise exception 'Candidato archivado o inexistente' using errcode='22023';end if;
 insert into mwd_partners_private.engagements
   (partner_id,stage,next_followup,created_by,updated_by)
 values(p_partner_id,p_stage,p_next_followup,v_actor,v_actor)
 on conflict(partner_id) do update
 set stage=excluded.stage,next_followup=excluded.next_followup,
 updated_by=v_actor,updated_at=now();
 return jsonb_build_object('status','saved_demo',
   'real_payments_enabled',false,'contract_signed',false,
   'payout_agent_authorized',false);
end; $$;

create or replace function public.mwd_owner_partner_audit_demo(p_partner_id uuid)
returns table(entity_type text,action text,actor_id uuid,changed_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 perform mwd_partners_private.assert_owner();
 return query select a.entity_type,a.action,a.actor_id,a.changed_at
 from mwd_partners_private.change_audit a
 where a.entity_id=p_partner_id
    or (a.entity_type in ('locations','due_diligence_reviews','engagements')
        and coalesce(a.after_row->>'partner_id',a.before_row->>'partner_id')=p_partner_id::text)
 order by a.changed_at desc,a.id desc limit 100;
end; $$;

revoke all on function public.mwd_owner_partner_engagement_demo(uuid) from public,anon,authenticated;
revoke all on function public.mwd_owner_partner_engagement_save_demo(uuid,text,date) from public,anon,authenticated;
grant execute on function public.mwd_owner_partner_engagement_demo(uuid) to authenticated;
grant execute on function public.mwd_owner_partner_engagement_save_demo(uuid,text,date) to authenticated;
