-- MONEDA MUNDIAL 2.0 • feed de auditoría para candidatos a socios
-- Solo demostración: no autoriza bancos, sucursales, retiros ni dinero real.
-- Función READ-ONLY; evita exponer filas JSON de auditoría al teléfono.
create or replace function public.mwd_owner_partner_audit_feed_demo(
  p_country_code text default null,
  p_partner_id uuid default null,
  p_limit integer default 50
)
returns table (
  audit_id bigint,
  partner_id uuid,
  partner_name text,
  country_code text,
  entity_type text,
  action text,
  actor_id uuid,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Autorización real en servidor; el filtro visual no sustituye este control.
  perform mwd_partners_private.assert_owner();

  if p_country_code is not null
     and p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Código de país inválido' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Límite de consulta inválido' using errcode = '22023';
  end if;

  return query
  select a.id, p.id, p.legal_name, p.country_code,
         a.entity_type, a.action, a.actor_id, a.changed_at
  from mwd_partners_private.change_audit a
  join mwd_partners_private.partners p
    on p.id = case
       when a.entity_type = 'partners' then a.entity_id
       when a.entity_type = 'locations' then
         nullif(coalesce(a.after_row->>'partner_id',
                         a.before_row->>'partner_id'), '')::uuid
       else null::uuid end
  where (p_country_code is null or p.country_code = p_country_code)
    and (p_partner_id is null or p.id = p_partner_id)
  order by a.changed_at desc, a.id desc
  limit p_limit;
end;
$function$;

revoke all on function public.mwd_owner_partner_audit_feed_demo(text,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.mwd_owner_partner_audit_feed_demo(text,uuid,integer)
  to authenticated;
