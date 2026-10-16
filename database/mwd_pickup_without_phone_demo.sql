-- MONEDA MUNDIAL 2.0 • ORDEN DE RETIRO SIN TELÉFONO: SOLO DEMOSTRACIÓN
-- No crea una remesa, no reserva fondos, no autoriza socios ni entrega efectivo.
-- No recolecta documentos de identidad, nombres, teléfonos ni datos bancarios.
-- NUNCA usar esta tabla ni sus códigos para prometer o efectuar pagos reales.

create schema if not exists mwd_pickup_private;
revoke all on schema mwd_pickup_private from public, anon, authenticated;

create table if not exists mwd_pickup_private.demo_orders (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  destination_country text not null check (destination_country ~ '^[A-Z]{2}$'),
  amount_cents bigint not null check (amount_cents between 100 and 100000),
  currency_code text not null default 'USD' check (currency_code='USD'),
  pickup_code_sha256 text not null unique check (pickup_code_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending','cancelled','simulated_collected')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  unique (sender_user_id, client_request_id)
);
create index if not exists demo_orders_sender_recent
  on mwd_pickup_private.demo_orders(sender_user_id,created_at desc);

create table if not exists mwd_pickup_private.demo_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references mwd_pickup_private.demo_orders(id),
  event_kind text not null check (event_kind in ('created','cancelled','simulated_collected')),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists demo_order_events_order_recent
  on mwd_pickup_private.demo_order_events(order_id,created_at desc);

alter table mwd_pickup_private.demo_orders enable row level security;
alter table mwd_pickup_private.demo_order_events enable row level security;
revoke all on all tables in schema mwd_pickup_private from public,anon,authenticated;
revoke all on all sequences in schema mwd_pickup_private from public,anon,authenticated;

-- Sólo se devuelve el código aleatorio en la primera creación exitosa.
-- Al repetir la solicitud, nunca se vuelve a divulgar el código secreto.
create or replace function public.mwd_pickup_create_demo(
  p_destination_country text,p_amount_cents bigint,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid := auth.uid();
  v_existing mwd_pickup_private.demo_orders%rowtype;
  v_new mwd_pickup_private.demo_orders%rowtype;
  v_code text;
begin
  if v_user is null then
    raise exception 'Inicia sesión' using errcode='42501';
  end if;
  if p_destination_country is null or p_destination_country !~ '^[A-Z]{2}$'
     or p_amount_cents is null or p_amount_cents not between 100 and 100000
     or p_request_id is null then
    raise exception 'Importe o país inválido para simulación' using errcode='22023';
  end if;

  select * into v_existing from mwd_pickup_private.demo_orders o
   where o.sender_user_id=v_user and o.client_request_id=p_request_id;
  if found then
    if v_existing.amount_cents<>p_amount_cents or
       v_existing.destination_country<>p_destination_country then
      raise exception 'Identificador reutilizado con datos diferentes'
        using errcode='22023';
    end if;
    return jsonb_build_object('status','already_created','orderId',v_existing.id,
      'pickupCode',null,'expiresAt',v_existing.expires_at,
      'realPaymentsEnabled',false);
  end if;

  v_code := 'SIM-' || upper(encode(extensions.gen_random_bytes(16),'hex'));
  insert into mwd_pickup_private.demo_orders
    (sender_user_id,client_request_id,destination_country,amount_cents,
     pickup_code_sha256,expires_at)
  values (v_user,p_request_id,p_destination_country,p_amount_cents,
          encode(extensions.digest(v_code,'sha256'),'hex'),
          clock_timestamp()+interval '24 hours')
  on conflict (sender_user_id,client_request_id) do nothing
  returning * into v_new;

  if v_new.id is null then
    select * into v_existing from mwd_pickup_private.demo_orders o
      where o.sender_user_id=v_user and o.client_request_id=p_request_id;
    if v_existing.id is null or v_existing.amount_cents<>p_amount_cents
       or v_existing.destination_country<>p_destination_country then
      raise exception 'Solicitud duplicada inconsistente' using errcode='22023';
    end if;
    return jsonb_build_object('status','already_created','orderId',v_existing.id,
      'pickupCode',null,'expiresAt',v_existing.expires_at,
      'realPaymentsEnabled',false);
  end if;

  insert into mwd_pickup_private.demo_order_events(order_id,event_kind,actor_id)
  values (v_new.id,'created',v_user);
  return jsonb_build_object('status','created','orderId',v_new.id,
    'pickupCode',v_code,'expiresAt',v_new.expires_at,
    'amountCents',p_amount_cents,'destinationCountry',p_destination_country,
    'realPaymentsEnabled',false,'isFunded',false,'canPayOut',false);
end; $fn$;

create or replace function public.mwd_pickup_my_orders_demo()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_user uuid := auth.uid(); v_data jsonb;
begin
  if v_user is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',o.id,'destinationCountry',o.destination_country,
    'amountCents',o.amount_cents,'currency',o.currency_code,
    'status',case when o.status='pending' and o.expires_at<=now()
       then 'expired' else o.status end,
    'createdAt',o.created_at,'expiresAt',o.expires_at,
    'processedAt',o.processed_at
  ) order by o.created_at desc),'[]'::jsonb) into v_data
  from (select * from mwd_pickup_private.demo_orders
        where sender_user_id=v_user order by created_at desc limit 50) o;
  return v_data;
end; $fn$;

create or replace function public.mwd_pickup_cancel_demo(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_user uuid := auth.uid(); v_order mwd_pickup_private.demo_orders%rowtype;
begin
  if v_user is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  if p_order_id is null then raise exception 'Falta referencia' using errcode='22023'; end if;
  select * into v_order from mwd_pickup_private.demo_orders o
    where o.id=p_order_id and o.sender_user_id=v_user for update;
  if not found then raise exception 'Orden de prueba no disponible' using errcode='22023'; end if;
  if v_order.status='cancelled' then
    return jsonb_build_object('status','already_cancelled','orderId',v_order.id);
  end if;
  if v_order.status<>'pending' then
    raise exception 'La orden ya no permite cancelación' using errcode='22023';
  end if;
  update mwd_pickup_private.demo_orders set status='cancelled'
    where id=v_order.id;
  insert into mwd_pickup_private.demo_order_events(order_id,event_kind,actor_id)
    values(v_order.id,'cancelled',v_user);
  return jsonb_build_object('status','cancelled','orderId',v_order.id,
    'realPaymentsEnabled',false);
end; $fn$;

-- Solo el propietario puede simular la entrega. No se efectúa ningún abono
-- bancario, retiro, liquidación, verificación real de identidad ni cargo de saldo.
create or replace function public.mwd_owner_pickup_simulate_demo(
  p_order_id uuid,p_pickup_code text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_actor uuid;
  v_order mwd_pickup_private.demo_orders%rowtype;
  v_clean text := upper(btrim(coalesce(p_pickup_code,'')));
begin
  v_actor := mwd_partners_private.assert_owner();
  if p_order_id is null or v_clean !~ '^SIM-[A-F0-9]{32}$' then
    raise exception 'Código o referencia de simulación inválida'
      using errcode='22023';
  end if;
  select * into v_order from mwd_pickup_private.demo_orders o
    where o.id=p_order_id for update;
  if not found or v_order.pickup_code_sha256<>
    encode(extensions.digest(v_clean,'sha256'),'hex') then
    raise exception 'Código o referencia de simulación inválida'
      using errcode='22023';
  end if;
  if v_order.status<>'pending' or v_order.expires_at<=clock_timestamp() then
    raise exception 'Orden vencida, cancelada o ya simulada' using errcode='22023';
  end if;
  update mwd_pickup_private.demo_orders
    set status='simulated_collected',processed_at=clock_timestamp(),processed_by=v_actor
    where id=v_order.id;
  insert into mwd_pickup_private.demo_order_events(order_id,event_kind,actor_id)
    values(v_order.id,'simulated_collected',v_actor);
  return jsonb_build_object('status','simulated_collected','orderId',v_order.id,
    'realPaymentsEnabled',false,'cashDisbursed',false);
end; $fn$;

create or replace function public.mwd_owner_pickup_orders_demo()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_orders jsonb;
begin
  perform mwd_partners_private.assert_owner();
  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',o.id,'destinationCountry',o.destination_country,
    'amountCents',o.amount_cents,
    'status',case when o.status='pending' and o.expires_at<=now()
       then 'expired' else o.status end,
    'createdAt',o.created_at,'expiresAt',o.expires_at,
    'processedAt',o.processed_at
  ) order by o.created_at desc),'[]'::jsonb) into v_orders
  from (select * from mwd_pickup_private.demo_orders
        order by created_at desc limit 50) o;
  return v_orders;
end; $fn$;

revoke all on function public.mwd_pickup_create_demo(text,bigint,uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_pickup_my_orders_demo()
 from public,anon,authenticated;
revoke all on function public.mwd_pickup_cancel_demo(uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_pickup_simulate_demo(uuid,text)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_pickup_orders_demo()
 from public,anon,authenticated;
grant execute on function public.mwd_pickup_create_demo(text,bigint,uuid) to authenticated;
grant execute on function public.mwd_pickup_my_orders_demo() to authenticated;
grant execute on function public.mwd_pickup_cancel_demo(uuid) to authenticated;
grant execute on function public.mwd_owner_pickup_simulate_demo(uuid,text) to authenticated;
grant execute on function public.mwd_owner_pickup_orders_demo() to authenticated;
