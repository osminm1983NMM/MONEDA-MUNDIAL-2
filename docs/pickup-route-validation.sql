-- Candidate: existing request recovery precedes route validation.
begin;
CREATE OR REPLACE FUNCTION public.mwd_pickup_create_demo(p_destination_country text, p_amount_cents bigint, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Serialize new requests per user to prevent parallel limit bypass.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 4107));

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

  if not exists (select 1 from mwd_finance_private.demo_fee_routes r where r.origin_country='US' and r.destination_country=p_destination_country and r.simulator_enabled is true and r.real_payments_enabled is false) then
    raise exception 'Ruta de simulación no disponible' using errcode='22023';
  end if;

  if (select count(*) from mwd_pickup_private.demo_orders o
      where o.sender_user_id=v_user
        and o.created_at > clock_timestamp()-interval '1 hour') >= 5 then
    raise exception 'Límite de 5 órdenes ficticias por hora. Intenta más tarde.'
      using errcode='P0001';
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
end; $function$;
rollback;
