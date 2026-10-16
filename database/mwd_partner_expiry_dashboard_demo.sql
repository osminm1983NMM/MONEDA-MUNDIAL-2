-- Reporte de vencimientos de candidatos: SOLO METADATOS, SIN SERVICIO FINANCIERO.
-- Requiere mwd_partners_private.{partners,due_diligence_reviews}
-- No certifica licencias ni genera pagos.
create or replace function public.mwd_owner_partner_expiry_dashboard_demo(
 p_days integer default 60
) returns table(
 partner_id uuid, partner_name text, country_code text, partner_status text,
 requirement_type text, review_status text, valid_until date,
 days_remaining integer, alert_level text
) language plpgsql security definer set search_path='' as $$
begin
 perform mwd_partners_private.assert_owner();
 if p_days is null or p_days not between 30 and 365 then
   raise exception 'Ventana inválida: utilizar entre 30 y 365 días' using errcode='22023';
 end if;
 return query
 select p.id,p.legal_name,p.country_code,p.review_status,
        req.type,
        coalesce(r.review_status,'not_started'::text),
        r.valid_until,
        case when r.valid_until is null then null::integer
             else (r.valid_until - current_date)::integer end,
        case when r.valid_until is null then 'missing_date'::text
             when r.valid_until < current_date then 'expired'::text
             when r.valid_until <= (current_date + 30) then 'due_soon'::text
             when r.valid_until <= (current_date + p_days) then 'due_within_window'::text
             else 'later'::text end
 from mwd_partners_private.partners p
 cross join (values
   ('regulatory_license'::text),('signed_agreement'::text),
   ('jurisdiction_permissions'::text)
 ) req(type)
 left join mwd_partners_private.due_diligence_reviews r
   on r.partner_id=p.id and r.requirement_type=req.type
 where p.review_status<>'archived'
 order by
   case when r.valid_until < current_date then 0
        when r.valid_until <= (current_date + 30) then 1
        when r.valid_until <= (current_date + p_days) then 2
        when r.valid_until is null then 3 else 4 end,
   r.valid_until nulls last,p.legal_name,p.id,req.type
 limit 600;
end; $$;
revoke all on function public.mwd_owner_partner_expiry_dashboard_demo(integer)
 from public,anon,authenticated;
grant execute on function public.mwd_owner_partner_expiry_dashboard_demo(integer)
 to authenticated;
