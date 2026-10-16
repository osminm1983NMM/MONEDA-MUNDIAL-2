-- Tablero exclusivamente interno de CANDIDATOS. NO permite habilitar dinero real.
-- SQL para Supabase y PostgreSQL aislado; no crea, cambia ni aprueba socios.
create or replace function public.mwd_owner_partner_readiness_overview_demo(
  p_country_code text default null
) returns table(
  partner_id uuid,
  partner_name text,
  country_code text,
  partner_kind text,
  partner_status text,
  branch_drafts integer,
  requirement_count integer,
  pending_requirements integer,
  internally_reviewed integer,
  expired_requirements integer,
  due_30_requirements integer,
  missing_critical_dates integer,
  real_payments_enabled boolean
) language plpgsql security definer set search_path = '' as $$
begin
  perform mwd_partners_private.assert_owner();
  if p_country_code is not null and p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Código de país inválido' using errcode='22023';
  end if;
  return query
    select p.id, p.legal_name, p.country_code, p.partner_kind, p.review_status,
           coalesce(branches.count_branches, 0)::integer,
           coalesce(progress.all_count, 0)::integer,
           coalesce(progress.pending_count, 0)::integer,
           coalesce(progress.reviewed_count, 0)::integer,
           coalesce(progress.expired_count, 0)::integer,
           coalesce(progress.due_soon_count, 0)::integer,
           coalesce(progress.missing_dates_count, 0)::integer,
           false
    from mwd_partners_private.partners p
    left join lateral (
      select count(*)::integer count_branches
      from mwd_partners_private.locations l where l.partner_id = p.id
    ) branches on true
    left join lateral (
      select
        count(*)::integer all_count,
        count(*) filter (
          where coalesce(d.review_status, 'not_started') <> 'reviewed_internal'
             or (d.valid_until is not null and d.valid_until < current_date)
        )::integer pending_count,
        count(*) filter (
          where d.review_status = 'reviewed_internal'
            and (d.valid_until is null or d.valid_until >= current_date)
        )::integer reviewed_count,
        count(*) filter (
          where d.valid_until < current_date
        )::integer expired_count,
        count(*) filter (
          where d.valid_until between current_date and current_date+30
        )::integer due_soon_count,
        count(*) filter (
          where types.kind in ('regulatory_license','jurisdiction_permissions','signed_agreement')
            and d.valid_until is null
        )::integer missing_dates_count
      from (values
        ('legal_registration'::text), ('regulatory_license'), ('jurisdiction_permissions'),
        ('signed_agreement'), ('aml_kyc_program'), ('sanctions_controls'),
        ('consumer_protection'), ('data_security'), ('settlement_controls'), ('tax_reporting')
      ) types(kind)
      left join mwd_partners_private.due_diligence_reviews d
        on d.partner_id = p.id and d.requirement_type = types.kind
    ) progress on true
    where p.review_status <> 'archived'
      and (p_country_code is null or p.country_code = p_country_code)
    order by p.country_code, p.legal_name, p.id
    limit 1000;
end; $$;
revoke all on function public.mwd_owner_partner_readiness_overview_demo(text)
 from public, anon, authenticated;
grant execute on function public.mwd_owner_partner_readiness_overview_demo(text)
 to authenticated;
