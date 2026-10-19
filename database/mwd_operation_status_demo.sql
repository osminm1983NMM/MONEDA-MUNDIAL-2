-- Moneda Mundial 2.0 • Consulta de estado de operaciones MWD ficticias.
-- Nunca crea, reintenta, debita, acredita ni cancela una transferencia.
-- UNCONFIRMED NO significa que la operación haya fallado: podría seguir en tránsito.
create or replace function public.mwd_operation_status_demo(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_op public.mwd_operations%rowtype;
  v_code text;
begin
  if v_actor is null then
    raise exception 'Se requiere una sesión autenticada' using errcode='42501';
  end if;
  if p_request_id is null then
    raise exception 'Referencia inválida' using errcode='22023';
  end if;
  select * into v_op from public.mwd_operations
   where actor_id=v_actor and request_id=p_request_id;
  if not found then
    return jsonb_build_object('mode','sandbox_only','realPaymentsEnabled',false,
      'status','unconfirmed','requestId',p_request_id);
  end if;
  if v_op.kind not in ('transfer','contribution') or
     v_op.source_user_id is distinct from v_actor then
    raise exception 'Registro requiere revisión' using errcode='55000';
  end if;
  if v_op.kind='transfer' then
    select account_code into v_code from public.mwd_wallets
     where user_id=v_op.destination_user_id;
    if v_code is null then
      raise exception 'Destino no verificable' using errcode='55000';
    end if;
  end if;
  return jsonb_build_object(
    'mode','sandbox_only','realPaymentsEnabled',false,
    'status','processed','requestId',p_request_id,
    'operationId',v_op.id,'kind',v_op.kind,'amountCents',v_op.amount_cents,
    'recipientCode',v_code,'createdAt',v_op.created_at
  );
end;
$fn$;

revoke all on function public.mwd_operation_status_demo(uuid) from public, anon, authenticated;
grant execute on function public.mwd_operation_status_demo(uuid) to authenticated;
