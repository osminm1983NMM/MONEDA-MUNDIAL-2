\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
grant execute on function auth.uid() to authenticated;

create table public.mwd_wallets(user_id uuid primary key,
 account_code text unique not null, balance_cents bigint not null);
create table public.mwd_operations(id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,request_id uuid not null,kind text not null,
 source_user_id uuid not null,destination_user_id uuid,
 amount_cents bigint not null,created_at timestamptz not null default now(),
 unique(actor_id,request_id));
insert into public.mwd_wallets values
 ('11111111-1111-4111-8111-111111111111','MWD-AAAAAAAAAAAAAAAA',100000),
 ('22222222-2222-4222-8222-222222222222','MWD-BBBBBBBBBBBBBBBB',200000);
\ir fixtures/mwd-core-rpcs-snapshot-demo.sql
\ir ../database/mwd_operation_status_demo.sql

set role authenticated;
do $checks$
declare
  first_result jsonb;
  second_result jsonb;
  other_result jsonb;
  other_again jsonb;
  checked jsonb;
  request_id uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'status'<>'unconfirmed' then raise exception 'Referencia inicial no disponible'; end if;
  first_result:=public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',1000,request_id);
  second_result:=public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',1000,request_id);
  if first_result->>'status'<>'ok' or second_result->>'status'<>'already_processed'
    or first_result->>'operation_id' is distinct from second_result->>'operation_id'
    then raise exception 'Error de idempotencia de transferencia'; end if;
  -- Una referencia ya procesada jamás puede reutilizarse con otro importe.
  begin
    perform public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',1001,request_id);
    raise exception 'Se aceptó la misma referencia con importe distinto';
  exception when raise_exception then
    if SQLERRM <> 'Identificador ya usado para otra operacion' then raise; end if;
  end;
  -- Las cuentas autenticadas consultan por RPC, no leen las tablas de saldos.
  begin
    perform count(*) from public.mwd_wallets;
    raise exception 'Se permitio acceso directo a saldos';
  exception when insufficient_privilege then null;
  end;
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'status'<>'processed'
    or checked->>'operationId' is distinct from first_result->>'operation_id'
    or checked->>'recipientCode'<>'MWD-BBBBBBBBBBBBBBBB'
    then raise exception 'Error de conciliación'; end if;
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'status'<>'unconfirmed' then raise exception 'Lectura ajena permitida'; end if;
  -- El mismo UUID es único DENTRO de cada actor, no globalmente:
  -- B puede usarlo para su propia operación, sin obtener el recibo de A.
  other_result:=public.mwd_transfer_demo('MWD-AAAAAAAAAAAAAAAA',150,request_id);
  other_again:=public.mwd_transfer_demo('MWD-AAAAAAAAAAAAAAAA',150,request_id);
  if other_result->>'status'<>'ok' or other_again->>'status'<>'already_processed'
    or other_result->>'operation_id' is distinct from other_again->>'operation_id'
    or other_result->>'operation_id' = first_result->>'operation_id' then
    raise exception 'Idempotencia o aislamiento de referencias por usuario incorrecto';
  end if;
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'operationId' is distinct from other_result->>'operation_id'
    or checked->>'recipientCode'<>'MWD-AAAAAAAAAAAAAAAA'
    then raise exception 'Cuenta B no puede verificar su propia referencia'; end if;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'operationId' is distinct from first_result->>'operation_id'
    then raise exception 'Cuenta A recibio datos de la operacion B'; end if;
  -- Sin una sesión válida ni siquiera se permite consultar estado.
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.mwd_operation_status_demo(request_id);
    raise exception 'Se permitio consultar sin sesion';
  exception when insufficient_privilege then null;
  end;
end $checks$;
reset role;
-- Solo el rol administrador verifica los saldos; el usuario autenticado
-- NO recibe SELECT directo a las tablas financieras.
do $balances$
begin
  if (select balance_cents from public.mwd_wallets where account_code='MWD-AAAAAAAAAAAAAAAA')<>99150
    or (select balance_cents from public.mwd_wallets where account_code='MWD-BBBBBBBBBBBBBBBB')<>200850
    or (select count(*) from public.mwd_operations o where o.request_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)<>2
    then raise exception 'Se alteraron saldos o se duplico una referencia por actor'; end if;
end $balances$;
select 'OK: dos cuentas aisladas, mismo UUID por actor, transferencias únicas y saldos correctos' as resultado;
