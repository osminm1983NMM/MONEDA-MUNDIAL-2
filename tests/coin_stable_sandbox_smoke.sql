-- MONEDA MUNDIAL 2.0 | Pruebas transaccionales del conversor ficticio
-- Ejecutar solo desde conexión SQL administrativa autorizada.
-- Todos los cambios de prueba se revierten con una subtransacción intencional.
-- NO es una prueba de HTTP/RLS extremo a extremo ni de ejecución concurrente.

do $tests$
declare
  v_owner uuid;
  v_user uuid;
  v_other uuid;
  v_coin_before bigint;
  v_stable_before bigint;
  v_coin_after bigint;
  v_stable_after bigint;
  v_request uuid;
  v_quote jsonb;
  v_duplicate jsonb;
  v_response jsonb;
  v_retry jsonb;
  v_receipt uuid;
  v_quote_id uuid;
  v_expired_id uuid;
  v_paused_id uuid;
  v_journal_count integer;
  v_unbalanced_count integer;
  v_policy_ts timestamptz;
  v_dashboard jsonb;
begin
  select user_id into v_owner from public.mwd_admin_roles
  where role='owner' limit 1;
  select id into v_user from auth.users
  where id is distinct from v_owner limit 1;
  select id into v_other from auth.users
  where id not in (v_owner,v_user) limit 1;
  if v_owner is null or v_user is null or v_other is null then
    raise exception 'Se requieren propietario y dos cuentas existentes para la prueba';
  end if;

  begin -- IMPORTANTE: todos los datos que se escriban aquí serán revertidos.
    perform pg_catalog.set_config('request.jwt.claim.sub',v_user::text,true);
    if auth.uid() is distinct from v_user then
      raise exception 'No se logró simular la identidad para esta prueba';
    end if;

    -- No propietario debe ser rechazado por funciones administrativas.
    begin
      perform public.mwd_owner_conversion_dashboard_demo();
      raise exception 'ALERTA: un no propietario pudo consultar administración';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.mwd_owner_conversion_policy_demo(
        false,0.125,25,'No propietario intenta cambiar cotización',now());
      raise exception 'ALERTA: un no propietario cambió configuración';
    exception when insufficient_privilege then null;
    end;

    -- Sólo tokens del usuario dueño de la cotización permiten confirmarla.
    perform public.mwd_conversion_wallet_demo();
    select balance_micro into v_coin_before from mwd_swap_private.demo_balances
      where user_id=v_user and asset_code='COIN';
    select balance_micro into v_stable_before from mwd_swap_private.demo_balances
      where user_id=v_user and asset_code='STABLE';

    -- Parámetros inválidos se rechazan.
    begin
      perform public.mwd_conversion_quote_demo('COIN',0,gen_random_uuid());
      raise exception 'ALERTA: aceptó importe cero';
    exception when invalid_parameter_value then null;
    end;

    v_request:=gen_random_uuid();
    v_quote:=public.mwd_conversion_quote_demo('COIN',10000000,v_request);
    v_quote_id:=(v_quote->>'quoteId')::uuid;
    v_duplicate:=public.mwd_conversion_quote_demo('COIN',10000000,v_request);
    if v_duplicate->>'quoteId' is distinct from v_quote->>'quoteId' then
      raise exception 'ALERTA: la cotización no es idempotente';
    end if;
    begin
      perform public.mwd_conversion_quote_demo('COIN',12000000,v_request);
      raise exception 'ALERTA: pudo reutilizar UUID con distinto importe';
    exception when invalid_parameter_value then null;
    end;

    -- Otra cuenta no puede usar la cotización de la primera.
    perform pg_catalog.set_config('request.jwt.claim.sub',v_other::text,true);
    begin
      perform public.mwd_conversion_confirm_demo(v_quote_id);
      raise exception 'ALERTA: una cuenta diferente convirtió fondos ajenos';
    exception when invalid_parameter_value then null;
    end;
    perform pg_catalog.set_config('request.jwt.claim.sub',v_user::text,true);

    v_response:=public.mwd_conversion_confirm_demo(v_quote_id);
    if v_response->>'status'<>'ok' then
      raise exception 'La conversión no se completó en prueba';
    end if;
    v_receipt:=(v_response->>'conversionId')::uuid;
    v_retry:=public.mwd_conversion_confirm_demo(v_quote_id);
    if v_retry->>'status'<>'already_processed'
       or (v_retry->>'conversionId')::uuid is distinct from v_receipt then
      raise exception 'ALERTA: repetición produjo efecto duplicado';
    end if;
    select balance_micro into v_coin_after from mwd_swap_private.demo_balances
      where user_id=v_user and asset_code='COIN';
    select balance_micro into v_stable_after from mwd_swap_private.demo_balances
      where user_id=v_user and asset_code='STABLE';
    if v_coin_after<>v_coin_before-10000000
       or v_stable_after<>v_stable_before+(v_quote->>'amountOutMicro')::bigint then
      raise exception 'ALERTA: débitos o créditos inesperados';
    end if;

    select count(*) into v_journal_count from mwd_swap_private.demo_journal
      where conversion_id=v_receipt;
    select count(*) into v_unbalanced_count from (
      select asset_code from mwd_swap_private.demo_journal
      where conversion_id=v_receipt
      group by asset_code having sum(delta_micro)<>0 or count(*)<>2
    ) unbalanced;
    if v_journal_count<>4 or v_unbalanced_count<>0 then
      raise exception 'ALERTA: diario contable no cuadra';
    end if;
    if (select count(*) from mwd_swap_private.demo_conversions
        where quote_id=v_quote_id)<>1 then
      raise exception 'ALERTA: ejecución duplicada de la cotización';
    end if;

    -- Conversiones vencidas nunca deben poder liquidarse.
    v_expired_id:=(public.mwd_conversion_quote_demo(
      'STABLE',1000000,gen_random_uuid())->>'quoteId')::uuid;
    update mwd_swap_private.demo_quotes
    set expires_at=clock_timestamp()-interval '3 seconds'
    where id=v_expired_id;
    begin
      perform public.mwd_conversion_confirm_demo(v_expired_id);
      raise exception 'ALERTA: confirmó cotización vencida';
    exception when invalid_parameter_value then null;
    end;

    -- La pausa afecta incluso una cotización previa a la pausa.
    v_paused_id:=(public.mwd_conversion_quote_demo(
      'STABLE',2000000,gen_random_uuid())->>'quoteId')::uuid;
    perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
    select updated_at into v_policy_ts from mwd_swap_private.demo_rates
      where id='sandbox_v1';
    perform public.mwd_owner_conversion_policy_demo(
      false,0.125,25,'Pausa transaccional de seguridad para prueba',v_policy_ts);
    v_dashboard:=public.mwd_owner_conversion_dashboard_demo();
    if (v_dashboard->>'active')::boolean is distinct from false then
      raise exception 'ALERTA: el tablero no refleja la pausa';
    end if;

    perform pg_catalog.set_config('request.jwt.claim.sub',v_user::text,true);
    begin
      perform public.mwd_conversion_confirm_demo(v_paused_id);
      raise exception 'ALERTA: la pausa permitió confirmar';
    exception when object_not_in_prerequisite_state then null;
    end;
    begin
      perform public.mwd_conversion_quote_demo('COIN',1000000,gen_random_uuid());
      raise exception 'ALERTA: la pausa permitió cotizar';
    exception when invalid_parameter_value then null;
    end;

    -- Señal que obliga al rollback de TODAS las operaciones de esta prueba.
    raise exception using errcode='ZT001',message='MONEDA_MUNDIAL_TEST_ROLLBACK';
  exception when sqlstate 'ZT001' then
    -- Sólo se interpreta como éxito si se llegó al último paso.
    raise notice 'PRUEBA APROBADA Y REVERTIDA: permisos, cotización, idempotencia, propietario, saldos, diario, vencimiento y pausa';
  end;
end;
$tests$;
