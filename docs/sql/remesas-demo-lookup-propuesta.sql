-- BORRADOR PARA REVISIÓN. NO EJECUTADO.
-- Recuperación de una orden DEMO por solicitud idempotente.
-- Antes de aplicar, revisar permisos de funciones existentes y probar con identidades aisladas.
begin;

create or replace function public.mwd_owner_remittance_lookup_demo(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_order mwd_remittance_demo_private.orders%rowtype;
begin
  v_actor := mwd_remittance_demo_private.assert_owner();
  if p_request_id is null then
    raise exception 'Referencia de recuperación requerida' using errcode='22023';
  end if;

  select * into v_order
  from mwd_remittance_demo_private.orders
  where created_by = v_actor and request_id = p_request_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'id', v_order.id,
    'status', v_order.status,
    'amount_cents', v_order.amount_cents,
    'destination_country', v_order.destination_country,
    'real_payments_enabled', false
  );
end;
$$;

revoke all on function public.mwd_owner_remittance_lookup_demo(uuid) from public, anon;
grant execute on function public.mwd_owner_remittance_lookup_demo(uuid) to authenticated;

commit;

-- PENDIENTE: pruebas de denegación a anon/no propietario, idempotencia,
-- consulta de orden ajena, rollback y revisión de asesores de seguridad.
