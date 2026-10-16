-- Resumen administrativo SOLO de remesas ficticias; nunca lee códigos,
-- identidad, saldo ni fondos reales. Datos de las últimas 100 órdenes.
create or replace function public.mwd_owner_remittance_monitor_demo(
 p_country_code text default null,p_limit integer default 50
) returns table(
 order_id uuid,source_country text,destination_country text,
 amount_cents bigint,order_status text,created_at timestamptz,
 event_count bigint,assignment_status text,pickup_status text,
 failed_attempts integer,expires_at timestamptz,identity_demo_checked boolean,
 anomaly_count integer,attention text,real_payments_enabled boolean
) language plpgsql security definer set search_path='' as $$
begin
 perform mwd_remittance_demo_private.assert_owner();
 if (p_country_code is not null and p_country_code !~ '^[A-Z]{2}$')
    or p_limit is null or p_limit not between 1 and 100 then
  raise exception 'Filtro administrativo inválido' using errcode='22023';
 end if;
 return query
 select o.id,o.source_country,o.destination_country,o.amount_cents,
  o.status,o.created_at,
  (select count(*) from mwd_remittance_demo_private.events ev where ev.order_id=o.id),
  coalesce(a.status,'unassigned'),
  coalesce(case when c.status='active' and now()>=c.expires_at
    then 'expired' else c.status end,'not_issued'),
  coalesce(c.failed_attempts,0),c.expires_at,
  coalesce(c.identity_check_simulated_at is not null,false),
  ((case when c.failed_attempts>=3 then 1 else 0 end)+
   (case when c.status='locked' then 1 else 0 end)+
   (case when o.status='cancelled' and c.status='active' then 1 else 0 end))::integer,
  case when c.status='locked' or c.failed_attempts>=3 or
                 (o.status='cancelled' and c.status='active') then 'review'
       when c.status='active' and now()>=c.expires_at then 'expired'
       else 'normal' end,
  false
 from mwd_remittance_demo_private.orders o
 left join mwd_remittance_demo_private.payout_assignments a on a.order_id=o.id
 left join mwd_remittance_demo_private.pickup_code_samples c on c.assignment_id=a.id
 where (p_country_code is null or o.destination_country=p_country_code)
 order by o.created_at desc,o.id desc
 limit p_limit;
end; $$;
revoke all on function public.mwd_owner_remittance_monitor_demo(text,integer)
 from public,anon,authenticated;
grant execute on function public.mwd_owner_remittance_monitor_demo(text,integer)
 to authenticated;
