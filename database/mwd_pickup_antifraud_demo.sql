-- Moneda Mundial 2.0 · Controles antifraude del retiro SIMULADO.
-- Sin pagos, sin KYC real y sin otorgar poderes a agentes candidatos.
-- Auditoría de intentos SIN guardar códigos ni hashes de códigos.
create table if not exists mwd_pickup_private.demo_claim_attempts (
  id bigint generated always as identity primary key,
  order_id uuid not null references mwd_pickup_private.demo_orders(id),
  actor_id uuid not null references auth.users(id),
  outcome text not null check (outcome in ('invalid','successful')),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists demo_claim_attempts_recent
 on mwd_pickup_private.demo_claim_attempts(order_id,created_at desc)
 where outcome='invalid';
alter table mwd_pickup_private.demo_claim_attempts enable row level security;
revoke all on mwd_pickup_private.demo_claim_attempts from public,anon,authenticated;
revoke all on sequence mwd_pickup_private.demo_claim_attempts_id_seq
 from public,anon,authenticated;

-- Ajuste de la función antigua: los intentos incorrectos ahora se AUDITAN.
-- No hacer RAISE después de almacenar un fallo: Postgres lo revertiría.
-- La fila de la orden se bloquea para contabilizar intentos concurrentes.
create or replace function public.mwd_owner_pickup_simulate_demo(
 p_order_id uuid, p_pickup_code text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_actor uuid;
  v_order mwd_pickup_private.demo_orders%rowtype;
  v_clean text := upper(btrim(coalesce(p_pickup_code,'')));
  v_failures integer;
begin
  v_actor := mwd_partners_private.assert_owner();
  if p_order_id is null then
    raise exception 'Solicitud de prueba inválida' using errcode='22023';
  end if;

  select * into v_order from mwd_pickup_private.demo_orders
  where id=p_order_id for update;
  if not found then
    raise exception 'Solicitud de prueba no disponible' using errcode='22023';
  end if;
  -- La orden no puede canjearse dos veces, incluso ante solicitudes simultáneas.
  if v_order.status <> 'pending' or v_order.expires_at <= clock_timestamp() then
    return jsonb_build_object('status','not_available','orderId',v_order.id,
       'cashDisbursed',false,'realPaymentsEnabled',false);
  end if;

  select count(*) into v_failures
  from mwd_pickup_private.demo_claim_attempts a
  where a.order_id=v_order.id and a.outcome='invalid'
    and a.created_at > clock_timestamp()-interval '15 minutes';
  if v_failures >= 5 then
    return jsonb_build_object('status','temporarily_blocked','orderId',v_order.id,
      'message','Demasiados códigos incorrectos. Intenta más tarde.',
      'cashDisbursed',false,'realPaymentsEnabled',false);
  end if;

  -- El código no se registra, ni se muestra en auditoría.
  if length(v_clean)>80 or v_clean !~ '^SIM-[A-F0-9]{32}$'
     or v_order.pickup_code_sha256 <>
        encode(extensions.digest(v_clean,'sha256'),'hex') then
    insert into mwd_pickup_private.demo_claim_attempts
       (order_id,actor_id,outcome)
    values(v_order.id,v_actor,'invalid');
    return jsonb_build_object('status','invalid_code',
      'orderId',v_order.id,'remainingAttempts',greatest(0,4-v_failures),
      'cashDisbursed',false,'realPaymentsEnabled',false);
  end if;

  update mwd_pickup_private.demo_orders
   set status='simulated_collected',
       processed_at=clock_timestamp(),processed_by=v_actor
   where id=v_order.id and status='pending';
  insert into mwd_pickup_private.demo_order_events(order_id,event_kind,actor_id)
  values(v_order.id,'simulated_collected',v_actor);
  insert into mwd_pickup_private.demo_claim_attempts(order_id,actor_id,outcome)
  values(v_order.id,v_actor,'successful');
  return jsonb_build_object('status','simulated_collected','orderId',v_order.id,
    'cashDisbursed',false,'realPaymentsEnabled',false);
end; $fn$;

-- Reporte limitado para el propietario. Jamás incluye el código ingresado.
create or replace function public.mwd_owner_pickup_security_demo()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
  v_recent jsonb;
  v_locked integer;
  v_failed_hour integer;
begin
  perform mwd_partners_private.assert_owner();

  select count(*) into v_failed_hour
  from mwd_pickup_private.demo_claim_attempts
  where outcome='invalid' and created_at>clock_timestamp()-interval '1 hour';

  select count(*) into v_locked from (
    select order_id from mwd_pickup_private.demo_claim_attempts
    where outcome='invalid' and created_at>clock_timestamp()-interval '15 minutes'
    group by order_id having count(*)>=5
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',a.order_id,'outcome',a.outcome,'time',a.created_at,
    'country',o.destination_country)
    order by a.created_at desc,a.id desc),'[]'::jsonb)
  into v_recent
  from (select * from mwd_pickup_private.demo_claim_attempts
        order by created_at desc,id desc limit 30) a
  join mwd_pickup_private.demo_orders o on o.id=a.order_id;

  return jsonb_build_object(
    'mode','demo_only','realPaymentsEnabled',false,
    'invalidAttemptsLastHour',v_failed_hour,
    'temporarilyBlockedOrders',v_locked,
    'recentAttempts',v_recent,
    'secretCodesLogged',false);
end; $fn$;

revoke all on function public.mwd_owner_pickup_simulate_demo(uuid,text)
 from public,anon,authenticated;
grant execute on function public.mwd_owner_pickup_simulate_demo(uuid,text)
 to authenticated;
revoke all on function public.mwd_owner_pickup_security_demo()
 from public,anon,authenticated;
grant execute on function public.mwd_owner_pickup_security_demo()
 to authenticated;
