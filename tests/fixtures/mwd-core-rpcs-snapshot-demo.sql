-- Copia de las dos funciones SOLO DEMO leídas del Supabase de pruebas el 2026-10-18.
-- Se usan ÚNICAMENTE con PostgreSQL descartable del CI.
-- Las modificaciones del servidor requieren refrescar esta instantánea.
-- NO son funciones de dinero real; no instalar ni distribuir como motor de pagos.
CREATE OR REPLACE FUNCTION public.mwd_contribute_demo(p_amount_cents bigint, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_balance bigint;
  v_existing public.mwd_operations%rowtype;
  v_operation_id uuid;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion';
  end if;
  if p_request_id is null or p_amount_cents is null
    or p_amount_cents < 1 or p_amount_cents > 100000000 then
    raise exception 'Solicitud o cantidad invalida';
  end if;

  select w.balance_cents into v_balance from public.mwd_wallets w
    where w.user_id = v_actor for update;
  if not found then
    raise exception 'Cuenta de prueba no disponible';
  end if;

  select * into v_existing from public.mwd_operations o
    where o.actor_id = v_actor and o.request_id = p_request_id;
  if found then
    if v_existing.kind <> 'contribution'
      or v_existing.source_user_id <> v_actor
      or v_existing.amount_cents <> p_amount_cents then
      raise exception 'Identificador ya usado para otra operacion';
    end if;
    return jsonb_build_object('status', 'already_processed',
      'operation_id', v_existing.id, 'balance_cents', v_balance);
  end if;

  if v_balance < p_amount_cents then
    raise exception 'Saldo ficticio insuficiente';
  end if;

  update public.mwd_wallets
    set balance_cents = balance_cents - p_amount_cents
    where user_id = v_actor;

  insert into public.mwd_operations
    (actor_id, request_id, kind, source_user_id, amount_cents)
    values (v_actor, p_request_id, 'contribution', v_actor, p_amount_cents)
    returning id into v_operation_id;

  return jsonb_build_object('status', 'ok',
    'operation_id', v_operation_id, 'balance_cents', v_balance - p_amount_cents);
end
$function$;

CREATE OR REPLACE FUNCTION public.mwd_transfer_demo(p_recipient_code text, p_amount_cents bigint, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_destination uuid;
  v_locked integer;
  v_balance bigint;
  v_destination_balance bigint;
  v_existing public.mwd_operations%rowtype;
  v_operation_id uuid;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion';
  end if;
  if p_request_id is null or p_amount_cents is null
    or p_amount_cents < 1 or p_amount_cents > 100000000 then
    raise exception 'Solicitud o cantidad invalida';
  end if;
  if p_recipient_code is null or char_length(btrim(p_recipient_code)) > 40 then
    raise exception 'Codigo de destino invalido';
  end if;

  select w.user_id into v_destination
  from public.mwd_wallets w
  where w.account_code = upper(btrim(p_recipient_code));
  if v_destination is null or v_destination = v_actor then
    raise exception 'Cuenta destinataria no disponible';
  end if;

  perform w.user_id from public.mwd_wallets w
  where w.user_id in (v_actor, v_destination)
  order by w.user_id for update;
  get diagnostics v_locked = row_count;
  if v_locked <> 2 then
    raise exception 'Cuenta de prueba no disponible';
  end if;

  select * into v_existing from public.mwd_operations o
  where o.actor_id = v_actor and o.request_id = p_request_id;
  if found then
    if v_existing.kind <> 'transfer' or v_existing.source_user_id <> v_actor
      or v_existing.destination_user_id <> v_destination
      or v_existing.amount_cents <> p_amount_cents then
      raise exception 'Identificador ya usado para otra operacion';
    end if;
    select w.balance_cents into v_balance from public.mwd_wallets w where w.user_id = v_actor;
    return jsonb_build_object('status', 'already_processed',
      'operation_id', v_existing.id, 'balance_cents', v_balance);
  end if;

  select w.balance_cents into v_balance from public.mwd_wallets w where w.user_id = v_actor;
  select w.balance_cents into v_destination_balance
    from public.mwd_wallets w where w.user_id = v_destination;
  if v_balance < p_amount_cents then
    raise exception 'Saldo ficticio insuficiente';
  end if;
  if v_destination_balance > 100000000000 - p_amount_cents then
    raise exception 'Limite de saldo ficticio alcanzado';
  end if;

  update public.mwd_wallets
    set balance_cents = balance_cents - p_amount_cents
    where user_id = v_actor;
  update public.mwd_wallets
    set balance_cents = balance_cents + p_amount_cents
    where user_id = v_destination;

  insert into public.mwd_operations
    (actor_id, request_id, kind, source_user_id, destination_user_id, amount_cents)
    values (v_actor, p_request_id, 'transfer', v_actor, v_destination, p_amount_cents)
    returning id into v_operation_id;

  return jsonb_build_object('status', 'ok',
    'operation_id', v_operation_id, 'balance_cents', v_balance - p_amount_cents);
end
$function$;
revoke all on function public.mwd_transfer_demo(text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.mwd_transfer_demo(text,bigint,uuid) to authenticated;
revoke all on function public.mwd_contribute_demo(bigint,uuid) from public,anon,authenticated;
grant execute on function public.mwd_contribute_demo(bigint,uuid) to authenticated;
