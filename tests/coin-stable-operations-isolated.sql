-- Prueba automática de conversión COIN/DIGITAL con PostgreSQL DESECHABLE.
-- Nunca ejecuta servicios bancarios, cadenas cripto ni Supabase del usuario.
\set ON_ERROR_STOP on
-- Los roles de PostgreSQL son globales al cluster, aunque cada prueba usa su propia BD.
-- Mantener las dos pruebas independientes sin fallar por roles creados previamente.
do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
end $roles$;
create schema auth;
grant usage on schema auth to authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $fn$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
grant execute on function auth.uid() to authenticated;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');

\ir ../database/mwd_coin_stable_conversion_demo.sql
\ir ../database/mwd_conversion_reconcile_demo.sql

do $check$
begin
 if has_schema_privilege('authenticated','mwd_swap_private','usage') or
    has_schema_privilege('anon','mwd_swap_private','usage') or
    has_function_privilege('anon','public.mwd_conversion_confirm_demo(uuid)','execute') or
    has_function_privilege('anon','public.mwd_conversion_wallet_demo()','execute') or
    has_function_privilege('anon','public.mwd_conversion_quote_demo(text,bigint,uuid)','execute') or
    has_function_privilege('anon','public.mwd_conversion_reconcile_demo(uuid)','execute') or
    not has_function_privilege('authenticated','public.mwd_conversion_confirm_demo(uuid)','execute') or
    not has_function_privilege('authenticated','public.mwd_conversion_wallet_demo()','execute') or
    not has_function_privilege('authenticated','public.mwd_conversion_quote_demo(text,bigint,uuid)','execute') or
    not has_function_privilege('authenticated','public.mwd_conversion_reconcile_demo(uuid)','execute')
 then raise exception 'Permisos incorrectos del conversor ficticio'; end if;
end $check$;

set role authenticated;
do $test$
declare
 v_one uuid:='11111111-1111-4111-8111-111111111111';
 v_two uuid:='22222222-2222-4222-8222-222222222222';
 v_quote jsonb;
 v_replay jsonb;
 v_confirm jsonb;
 v_reconfirm jsonb;
 v_conciliation jsonb;
 v_wallet jsonb;
 v_other_wallet jsonb;
 v_one_receipt uuid;
 v_two_receipt uuid;
 v_first_balance bigint;
 v_first_stable bigint;
 v_second_balance bigint;
 v_second_stable bigint;
 v_out bigint;
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',v_one::text,false);
 v_wallet:=public.mwd_conversion_wallet_demo();
 v_first_balance:=(v_wallet->>'coinMicro')::bigint;
 v_first_stable:=(v_wallet->>'stableMicro')::bigint;
 if v_wallet->>'mode'<>'sandbox_only' or
    (v_wallet->>'realPaymentsEnabled')::boolean is distinct from false or
    v_first_balance<>100000000 or v_first_stable<>1000000000
 then raise exception 'Billetera inicial 1 insegura'; end if;
 -- Identificador de petición 1, sin repetir el dinero al pedir de nuevo.
 v_quote:=public.mwd_conversion_quote_demo('COIN',10000000,
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
 v_replay:=public.mwd_conversion_quote_demo('COIN',10000000,
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
 if v_quote->>'quoteId' is distinct from v_replay->>'quoteId'
    or v_quote->>'provider'<>'synthetic_sandbox' or
    (v_quote->>'realPaymentsEnabled')::boolean is distinct from false
 then raise exception 'Cotización ficticia incorrecta o no idempotente'; end if;
 begin
   perform public.mwd_conversion_quote_demo('COIN',20000000,
      'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
   raise exception 'Reuso de referencia con importe distinto permitido';
 exception when invalid_parameter_value then null;
 end;

 -- Cuenta 2 NO puede confirmar ni consultar la cotización de cuenta 1.
 perform pg_catalog.set_config('request.jwt.claim.sub',v_two::text,false);
 v_other_wallet:=public.mwd_conversion_wallet_demo();
 v_second_balance:=(v_other_wallet->>'coinMicro')::bigint;
 v_second_stable:=(v_other_wallet->>'stableMicro')::bigint;
 begin
   perform public.mwd_conversion_confirm_demo((v_quote->>'quoteId')::uuid);
   raise exception 'Se permitió operación de una cuenta ajena';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.mwd_conversion_reconcile_demo((v_quote->>'quoteId')::uuid);
   raise exception 'Se permitió consultar cotización ajena';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform count(*) from mwd_swap_private.demo_balances;
   raise exception 'Se permitió acceso directo a saldos ficticios';
 exception when insufficient_privilege then null;
 end;

 -- Cuenta 1 convierte COIN -> Digital; repeticiones no duplican resultados.
 perform pg_catalog.set_config('request.jwt.claim.sub',v_one::text,false);
 v_confirm:=public.mwd_conversion_confirm_demo((v_quote->>'quoteId')::uuid);
 v_one_receipt:=(v_confirm->>'conversionId')::uuid;
 v_out:=(v_quote->>'amountOutMicro')::bigint;
 if v_confirm->>'status'<>'ok' then raise exception 'Conversión inicial no procesada'; end if;
 v_reconfirm:=public.mwd_conversion_confirm_demo((v_quote->>'quoteId')::uuid);
 if v_reconfirm->>'status'<>'already_processed' or
    v_reconfirm->>'conversionId' is distinct from v_confirm->>'conversionId'
 then raise exception 'La confirmación duplicó la operación'; end if;
 v_conciliation:=public.mwd_conversion_reconcile_demo((v_quote->>'quoteId')::uuid);
 if v_conciliation->>'status'<>'executed' or
    v_conciliation->>'conversionId' is distinct from v_confirm->>'conversionId'
 then raise exception 'El recibo no concilia contra la cotización'; end if;
 v_wallet:=public.mwd_conversion_wallet_demo();
 if (v_wallet->>'coinMicro')::bigint<>v_first_balance-10000000 or
    (v_wallet->>'stableMicro')::bigint<>v_first_stable+v_out or
    jsonb_array_length(v_wallet->'history')<>1
 then raise exception 'Saldos o historial cuenta 1 incorrectos'; end if;

 -- Cuenta 2 invierte la conversión, sin alterar los saldos cuenta 1.
 perform pg_catalog.set_config('request.jwt.claim.sub',v_two::text,false);
 v_quote:=public.mwd_conversion_quote_demo('STABLE',1000000,
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb');
 v_confirm:=public.mwd_conversion_confirm_demo((v_quote->>'quoteId')::uuid);
 v_two_receipt:=(v_confirm->>'conversionId')::uuid;
 v_wallet:=public.mwd_conversion_wallet_demo();
 if (v_wallet->>'coinMicro')::bigint<>v_second_balance+(v_quote->>'amountOutMicro')::bigint or
    (v_wallet->>'stableMicro')::bigint<>v_second_stable-1000000 or
    jsonb_array_length(v_wallet->'history')<>1
 then raise exception 'Saldos o historial cuenta 2 incorrectos'; end if;
 perform pg_catalog.set_config('request.jwt.claim.sub',v_one::text,false);
 v_wallet:=public.mwd_conversion_wallet_demo();
 if (v_wallet->>'coinMicro')::bigint<>v_first_balance-10000000 or
    (v_wallet->>'stableMicro')::bigint<>v_first_stable+v_out or
    jsonb_array_length(v_wallet->'history')<>1
 then raise exception 'Mezcla de saldos entre cuentas'; end if;

 -- Cotización a vencer, sin ejecutarla, para comprobar cierre sin cargo.
 perform public.mwd_conversion_quote_demo('COIN',1000000,
    'cccccccc-3333-4333-8333-cccccccccccc');
end $test$;
reset role;

-- Manipulación de reloj SOLO EN LA BASE DESCARTABLE para simular expiración.
update mwd_swap_private.demo_quotes
 set expires_at=clock_timestamp()-interval '10 seconds'
 where client_request_id='cccccccc-3333-4333-8333-cccccccccccc';
set role authenticated;
do $expired$
declare
 v_quote_id uuid;
 v_status jsonb;
begin
 perform pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
 -- El UUID de cotización se obtiene consultando el mismo identificador original.
 v_quote_id:=(public.mwd_conversion_quote_demo('COIN',1000000,
    'cccccccc-3333-4333-8333-cccccccccccc')->>'quoteId')::uuid;
 begin
   perform public.mwd_conversion_confirm_demo(v_quote_id);
   raise exception 'Se ejecutó una cotización ficticia vencida';
 exception when invalid_parameter_value then null;
 end;
 v_status:=public.mwd_conversion_reconcile_demo(v_quote_id);
 if v_status->>'status'<>'expired' or v_status->>'conversionId' is not null
 then raise exception 'Expiración incoherente'; end if;
end $expired$;
reset role;

-- Dos liquidaciones y nada más; cada activo mantiene libro de suma cero.
do $audit$
begin
 if (select count(*) from mwd_swap_private.demo_conversions)<>2 or
    (select count(*) from mwd_swap_private.demo_journal)<>8 or
    (select count(*) from mwd_swap_private.demo_quotes where status='executed')<>2
 then raise exception 'Duplicación o asiento contable faltante'; end if;
 if exists(
   select conversion_id,asset_code from mwd_swap_private.demo_journal
   group by conversion_id,asset_code
   having sum(delta_micro)<>0 or count(*)<>2
 ) then raise exception 'El diario de conversión no está balanceado'; end if;
end $audit$;

select 'OK: 2 usuarios separados, conversión doble sentido, recibo único, expiración, permisos y asiento balanceado' as resultado;
