-- Moneda Mundial 2.0 | Consultar SIN REEJECUTAR una conversión ficticia incierta.
-- Implementación propuesta: no ejecutar en producción ni habilitar dinero real.
-- Requiere haber instalado database/mwd_coin_stable_conversion_demo.sql.
-- La fila de cotización se bloquea para serializar el resultado con la confirmación.
create or replace function public.mwd_conversion_reconcile_demo(p_quote_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_quote mwd_swap_private.demo_quotes%rowtype;
  v_conversion mwd_swap_private.demo_conversions%rowtype;
  v_state text;
begin
  if v_user is null then
    raise exception 'Sesión requerida' using errcode='42501';
  end if;
  if p_quote_id is null then
    raise exception 'Referencia inválida' using errcode='22023';
  end if;

  -- Impide inspeccionar transacciones ajenas y observa los commits de confirmación.
  select * into v_quote
    from mwd_swap_private.demo_quotes
    where id=p_quote_id and user_id=v_user
    for update;
  if not found then
    raise exception 'Referencia no disponible' using errcode='22023';
  end if;

  if v_quote.status='executed' then
    select * into v_conversion
      from mwd_swap_private.demo_conversions
      where quote_id=p_quote_id and user_id=v_user;
    if not found then
      raise exception 'Conciliación pendiente de revisión' using errcode='55000';
    end if;
    v_state:='executed';
  elsif v_quote.status='quoted' and v_quote.expires_at<=clock_timestamp() then
    -- Una cotización no ejecutada y ya vencida no puede ser confirmada después.
    v_state:='expired';
  elsif v_quote.status='quoted' then
    v_state:='quoted';
  else
    raise exception 'Estado desconocido' using errcode='55000';
  end if;

  return jsonb_build_object(
    'mode','sandbox_only','realPaymentsEnabled',false,
    'status',v_state,'quoteId',v_quote.id,
    'fromAsset',v_quote.from_asset,'toAsset',v_quote.to_asset,
    'amountInMicro',v_quote.amount_in_micro,
    'amountOutMicro',v_quote.amount_out_micro,
    'feeOutMicro',v_quote.fee_out_micro,
    'conversionId',case when v_state='executed' then v_conversion.id else null end
  );
end;
$fn$;

-- La función pública tiene acceso por RPC únicamente con token autenticado.
-- El rol autenticado NO obtiene acceso directo al esquema privado.
revoke all on function public.mwd_conversion_reconcile_demo(uuid) from public, anon, authenticated;
grant execute on function public.mwd_conversion_reconcile_demo(uuid) to authenticated;
